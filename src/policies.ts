import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
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

export const policies: Policy[] = [packageJson];
