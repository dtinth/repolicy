import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { globby } from "globby";
import { join } from "path";
import type { Policy } from "./types.js";

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function getGitHubRepo(repoPath: string): string | undefined {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: repoPath,
      stdio: ["pipe", "pipe", "pipe"],
    })
      .toString()
      .trim();
    return url.match(/github\.com[:/]([^/]+\/[^.]+)/)?.[1];
  } catch {
    return undefined;
  }
}

const packageJson: Policy = {
  name: "package.json",
  async check({ repoPath, report, queue }) {
    const filePath = join(repoPath, "package.json");
    if (!existsSync(filePath)) {
      report("package.json is missing", {
        description: "Create an empty package.json",
        async execute() {
          writeJson(filePath, {});
        },
      });
      return;
    }

    let pkg: any;
    try {
      pkg = readJson(filePath);
    } catch {
      report("package.json is not valid JSON");
      return;
    }

    const save = () => writeJson(filePath, pkg);

    queue({
      name: "package.json > name",
      async check({ report }) {
        if (!pkg.name) report("name field is missing");
      },
    });

    queue({
      name: "package.json > version",
      async check({ report }) {
        if (!pkg.version) {
          report("version field is missing", {
            description: 'Set version to "0.0.0"',
            async execute() {
              pkg.version = "0.0.0";
              save();
            },
          });
        }
      },
    });

    queue({
      name: 'package.json > "type": "module"',
      async check({ report }) {
        if (pkg.type !== "module") {
          report('"type" should be "module"', {
            description: 'Set "type" to "module"',
            async execute() {
              pkg.type = "module";
              save();
            },
          });
        }
      },
    });

    const gitHubRepo = getGitHubRepo(repoPath);
    if (gitHubRepo) {
      queue({
        name: "package.json > repository",
        async check({ report }) {
          const expected = {
            type: "git",
            url: `git+https://github.com/${gitHubRepo}.git`,
          };
          if (JSON.stringify(pkg.repository) !== JSON.stringify(expected)) {
            report("repository field is missing or incorrect", {
              description: `Set repository to GitHub repo ${gitHubRepo}`,
              async execute() {
                pkg.repository = expected;
                save();
              },
            });
          }
        },
      });

      queue({
        name: "package.json > homepage",
        async check({ report }) {
          const expected = `https://github.com/${gitHubRepo}#readme`;
          if (pkg.homepage !== expected) {
            report("homepage field is missing or incorrect", {
              description: `Set homepage to ${expected}`,
              async execute() {
                pkg.homepage = expected;
                save();
              },
            });
          }
        },
      });

      queue({
        name: "package.json > bugs",
        async check({ report }) {
          const expected = {
            url: `https://github.com/${gitHubRepo}/issues`,
          };
          if (JSON.stringify(pkg.bugs) !== JSON.stringify(expected)) {
            report("bugs field is missing or incorrect", {
              description: `Set bugs to ${expected.url}`,
              async execute() {
                pkg.bugs = expected;
                save();
              },
            });
          }
        },
      });
    }
  },
};

function unwantedDevDep(name: string): Policy {
  return {
    name: `devDependencies > no ${name}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg.devDependencies?.[name] !== undefined) {
        report(`${name} should not be a devDependency`, {
          description: `Remove ${name} from devDependencies`,
          async execute() {
            delete pkg.devDependencies[name];
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function unwantedFile(relativePath: string): Policy {
  return {
    name: `no ${relativePath}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, relativePath);
      if (existsSync(filePath)) {
        report(`${relativePath} should not exist`, {
          description: `Delete ${relativePath}`,
          async execute() {
            rmSync(filePath, { recursive: true });
          },
        });
      }
    },
  };
}

export const policies: Policy[] = [
  packageJson,
  // Old Rush Stack tooling
  unwantedDevDep("@rushstack/heft"),
  unwantedDevDep("@rushstack/heft-web-rig"),
  unwantedDevDep("@types/heft-jest"),
  // Old test frameworks (replaced by vitest via vite-plus)
  unwantedDevDep("jest"),
  unwantedDevDep("@types/jest"),
  unwantedDevDep("mocha"),
  unwantedDevDep("chai"),
  // Old release tooling (replaced by changesets)
  unwantedDevDep("bumpp"),
  unwantedDevDep("release-it"),
  // Old formatting (replaced by oxfmt via vite-plus)
  unwantedDevDep("prettier"),
  // Old doc tooling
  unwantedDevDep("@microsoft/api-documenter"),
  unwantedDevDep("api-documenter-yaml-to-antora-asciidoc"),
  unwantedDevDep("news-fragments"),
  unwantedDevDep("@spacet.me/news-fragments"),
  // Standalone typescript (provided by vite-plus)
  unwantedDevDep("typescript"),
  // Linting (replaced by oxlint via vite-plus)
  unwantedDevDep("eslint"),
  unwantedDevDep("@eslint/eslintrc"),
  unwantedDevDep("@eslint/js"),
  unwantedDevDep("eslint-config-prettier"),
  // Testing (use vite-plus/test instead)
  unwantedDevDep("vitest"),
  // Bundling (bundled in vite-plus)
  unwantedDevDep("tsdown"),
  unwantedDevDep("vite"),
  // Yarn leftovers (migrated to pnpm)
  unwantedFile("yarn.lock"),
  unwantedFile(".yarnrc"),
  unwantedFile(".yarnrc.yml"),
  unwantedFile(".yarn"),
  // Prettier (replaced by oxfmt via vite-plus)
  unwantedFile(".prettierrc"),
  unwantedFile(".prettierrc.yml"),
  unwantedFile(".prettierrc.js"),
  unwantedFile(".prettierignore"),
  // Rush Stack config files
  unwantedFile("tsconfig-base.json"),
  unwantedFile("config/rig.json"),
  unwantedFile("config/jest.config.json"),
  unwantedFile("config/api-extractor.json"),
  // API extractor output
  {
    name: "no etc/*.api.md",
    async check({ repoPath, report }) {
      const apiMdFiles = await globby("etc/*.api.md", { cwd: repoPath });
      for (const file of apiMdFiles) {
        report(`${file} should not exist`, {
          description: `Delete ${file} and etc/README.md`,
          async execute() {
            rmSync(join(repoPath, file));
            const readme = join(repoPath, "etc/README.md");
            if (existsSync(readme)) rmSync(readme);
          },
        });
      }
    },
  },
];
