# repolicy

Tools for automatically maintaining multi-repo JavaScript projects.

Planned features:

- Automatically set up standardized `npm` scripts and `package.json` fields to a shared convention, such as `files`, `main`, `module`, `types`, `homepage`, `bugs`, `repository`.

- Automatically set up standardized configuration file, such as `tsconfig`, `eslint`, `prettier`.

- Automatically set up GitHub Actions workflows for lint/test/releases.

- Provides scripts to check if any repo is diverged from the specified policy (due to policy updates or manual changes), and provide automated migration path to bring the repo back into compliance.

Rough design:

- Instead of using sharable config files (to which there are frictions in updating), individual configuration files are **copied directly into a project.** If the current policy doesn’t meet the project’s needs, then individual projects may to change the configuration files. This brings the project out of compliance. It is expected that the changes will be incorporated back into the policy to make it more flexible, thus bringing the project back into compliance.
