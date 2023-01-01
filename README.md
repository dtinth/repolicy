# repolicy

Tools for automatically maintaining multi-repo JavaScript projects that is following a [golden path](https://engineering.atspotify.com/2020/08/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem/).

Planned features:

- Automatically set up standardized `npm` scripts and `package.json` fields to a shared convention, such as `files`, `main`, `module`, `types`, `homepage`, `bugs`, `repository`.

- Automatically set up standardized configuration file, such as `tsconfig`, `eslint`, `prettier`.

- Automatically set up GitHub Actions workflows for lint/test/releases.

- Provides scripts to check if any repo is diverged from the specified policy (due to policy updates or manual changes), and provide automated migration path to bring the repo back into compliance.

Rough design:

- Instead of using sharable config files (to which there are frictions in updating), individual configuration files are **copied directly into a project.** If the current policy doesn’t meet the project’s needs, then individual projects may to change the configuration files. This brings the project out of compliance. It is expected that the changes will be incorporated back into the policy to make it more flexible, thus bringing the project back into compliance.

- There is a list of **policies** to be _applied_ to a repository. [Here’s an example PR of policies being applied.](https://github.com/dtinth/minitracer/pull/3) Each is like an Ansible task — it is idempotent, which means they can be run on both new (empty) and existing repos. Here an example of policies.

  - Package has a name — If `package.json` has a `name` field, leave it as-is. Otherwise, put the repository name as `name` field.
  - Package has a types entrypoint — Sets the `types` field in `package.json` to `./dist/${unscopedPackageName}.d.ts`
  - Managed script "build" — Sets the `scripts.build` field in `package.json` to `heft build`
  - Managed file ".prettierrc.yml" — Replaces the contents of `.prettierrc.yml` with the one specified in the policy.
  - Unwanted file ".prettierrc" — Removes `.prettierrc` from the repository (because `.yml` is used instead).
  - Managed devDependency — Sets a specific version of a package as `devDependency`
  - Unwanted devDependency — Removes a package from `devDependency` (useful when migrating to other tools)

## Repositories managed by this tool

- Check out [`projects.yml`](projects.yml) for the complete list.
