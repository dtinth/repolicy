import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { globby } from "globby";
import { dirname, join } from "path";
import { parseTree, getNodeValue } from "jsonc-parser";
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

function requiredDevDep(name: string, version: string): Policy {
  return {
    name: `devDependencies > ${name}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg.devDependencies?.[name] !== version) {
        report(`${name} should be set to ${version}`, {
          description: `Set ${name} to ${version} in devDependencies`,
          async execute() {
            if (!pkg.devDependencies) pkg.devDependencies = {};
            pkg.devDependencies[name] = version;
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function requiredPnpmOverride(key: string, value: string): Policy {
  return {
    name: `pnpm.overrides > ${key}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg.pnpm?.overrides?.[key] !== value) {
        report(`pnpm.overrides.${key} should be set to ${value}`, {
          description: `Set pnpm.overrides.${key} to ${value}`,
          async execute() {
            if (!pkg.pnpm) pkg.pnpm = {};
            if (!pkg.pnpm.overrides) pkg.pnpm.overrides = {};
            pkg.pnpm.overrides[key] = value;
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function requiredScript(name: string, value: string): Policy {
  return {
    name: `scripts > ${name}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg.scripts?.[name] !== value) {
        report(`scripts.${name} should be set to "${value}"`, {
          description: `Set scripts.${name} to "${value}"`,
          async execute() {
            if (!pkg.scripts) pkg.scripts = {};
            pkg.scripts[name] = value;
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function requiredFilesEntry(entry: string): Policy {
  return {
    name: `files > ${entry}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (!pkg.files?.includes(entry)) {
        report(`files should include "${entry}"`, {
          description: `Add "${entry}" to files array`,
          async execute() {
            if (!pkg.files) pkg.files = [];
            pkg.files.push(entry);
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function unwantedFilesEntry(entry: string): Policy {
  return {
    name: `files > no ${entry}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg.files?.includes(entry)) {
        report(`files should not include "${entry}"`, {
          description: `Remove "${entry}" from files array`,
          async execute() {
            pkg.files = pkg.files.filter((f: string) => f !== entry);
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function unwantedField(field: string): Policy {
  return {
    name: `package.json > no ${field}`,
    async check({ repoPath, report }) {
      const filePath = join(repoPath, "package.json");
      if (!existsSync(filePath)) return;
      const pkg = readJson(filePath);
      if (pkg[field] !== undefined) {
        report(`${field} should not be set`, {
          description: `Remove ${field} field`,
          async execute() {
            delete pkg[field];
            writeJson(filePath, pkg);
          },
        });
      }
    },
  };
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

const tsconfigJson: Policy = {
  name: "tsconfig.json",
  async check({ repoPath, report }) {
    const filePath = join(repoPath, "tsconfig.json");
    if (!existsSync(filePath)) {
      report("tsconfig.json is missing", {
        description: "Create tsconfig.json extending from tsconfig-base.json",
        async execute() {
          const defaultConfig = {
            extends: "./tsconfig-base.json",
            include: ["src"],
          };
          writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2) + "\n");
        },
      });
      return;
    }

    // Parse with comment support
    const content = readFileSync(filePath, "utf-8");
    const errors: any[] = [];
    const parsed = parseTree(content, errors, { allowTrailingComma: true });

    if (errors.length > 0 || !parsed) {
      report("tsconfig.json has parse errors");
      return;
    }

    // Get the actual value from the parse tree
    const config = getNodeValue(parsed!) as any;

    // Check for unwanted heft-jest type
    const types = config?.compilerOptions?.types;
    if (Array.isArray(types) && types.includes("heft-jest")) {
      report(
        '"heft-jest" should not be in compilerOptions.types',
        "Remove heft-jest from compilerOptions.types array to preserve any comments in the file",
      );
    }
  },
};

const skeletonFiles: Policy = {
  name: "skeleton files",
  async check({ queue }) {
    // Find repolicy's skel directory
    // The CLI is bundled as dist/cli.mjs, so skel is at ../skel from dist/
    const currentFile = new URL(import.meta.url).pathname;
    const packageRoot = dirname(dirname(currentFile));
    const skelDir = join(packageRoot, "skel");

    if (!existsSync(skelDir)) {
      return;
    }

    // Find all files in skel directory
    const skelFiles = await globby("**/*", {
      cwd: skelDir,
      onlyFiles: true,
      dot: true,
    });

    for (const relPath of skelFiles) {
      const skelFilePath = join(skelDir, relPath);
      const expectedContent = readFileSync(skelFilePath, "utf-8");

      queue({
        name: `skel > ${relPath}`,
        async check({ repoPath, report }) {
          const targetPath = join(repoPath, relPath);

          if (!existsSync(targetPath)) {
            report(`${relPath} is missing`, {
              description: `Create ${relPath} from skeleton`,
              async execute() {
                const targetDir = dirname(targetPath);
                if (!existsSync(targetDir)) {
                  execSync(`mkdir -p "${targetDir}"`);
                }
                writeFileSync(targetPath, expectedContent);
              },
            });
            return;
          }

          const actual = normalizeNewlines(readFileSync(targetPath, "utf-8"));
          const expected = normalizeNewlines(expectedContent);

          if (actual !== expected) {
            report(`${relPath} does not match skeleton`, {
              description: `Update ${relPath} from skeleton`,
              async execute() {
                writeFileSync(targetPath, expectedContent);
              },
            });
          }
        },
      });
    }
  },
};

export const policies: Policy[] = [
  packageJson,
  tsconfigJson,
  skeletonFiles,
  requiredDevDep("vite-plus", "^0.1.14"),
  requiredDevDep("@changesets/cli", "^2.30.0"),
  requiredDevDep("@typescript/native-preview", "7.0.0-dev.20260328.1"),
  requiredPnpmOverride("vite", "npm:@voidzero-dev/vite-plus-core@latest"),
  requiredPnpmOverride("vitest", "npm:@voidzero-dev/vite-plus-test@latest"),
  requiredScript("build", "vp pack"),
  requiredScript("dev", "vp pack --watch"),
  requiredScript("test", "vp test"),
  requiredScript("check", "vp check"),
  requiredScript("prepublishOnly", "vp run build"),
  requiredScript("prepare", "vp config"),
  requiredFilesEntry("src"),
  requiredFilesEntry("dist"),
  unwantedFilesEntry("lib"),
  unwantedFilesEntry("lib-commonjs"),
  unwantedField("main"),
  unwantedField("module"),
  unwantedField("types"),
  unwantedField("docModel"),
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
  // News fragments (replaced by changesets)
  unwantedFile("fragments/.gitkeep"),
  // Prettier (replaced by oxfmt via vite-plus)
  unwantedFile(".prettierrc"),
  unwantedFile(".prettierrc.yml"),
  unwantedFile(".prettierrc.js"),
  unwantedFile(".prettierignore"),
  // Rush Stack config files
  unwantedFile("config/rig.json"),
  unwantedFile("config/jest.config.json"),
  unwantedFile("config/api-extractor.json"),
  // Old build scripts
  unwantedFile("scripts/release"),
  unwantedFile("scripts/generate-api-docs"),
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
