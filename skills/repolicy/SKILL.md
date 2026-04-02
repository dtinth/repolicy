---
name: repolicy
description: Use this skill when the repository is managed using repolicy. The human will explicitly mention this skill.
---

Repolicy is a global CLI to help maintaining repositories.
Run `repolicy` to check if repository is currently in compliance.
Run `repolicy -v` to see all policies.
To automatically fix, run `repolicy fix -v` to try to bring the repository in compliance.
If manual action is needed, the fix command will tell you what to do. Do it then run `repolicy fix -v` again.

Once the repository is in compliance, the package may not build or test correctly.
First run `vp install` to install dependencies and update lockfile.
Afterwards, run `vp run check --fix`. Once all checks are passing, run `vp run test`.

If checks failed due to missing file extension when importing, add `.ts` to import statements when importing files in the project. Use `.ts`, not `.js`, as `"allowImportingTsExtensions"` is set to true.

For missing test-related globals such as `describe`, `it`, `expect`, import them from `vite-plus/test`.

If user asks you to bump version, know that repolicy-managed projects uses Changesets with auto-publishing/versioning via GitHub Actions, the changeset CLI is not usable by agents. You will have to create a changeset file manually. If you are not completely sure whether it's major/minor/patch, then AskUserQuestion to clarify.
