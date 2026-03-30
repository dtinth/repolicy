# repolicy

Tools for automatically maintaining open source TypeScript libraries published to npm that follow a [golden path](https://engineering.atspotify.com/2020/08/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem/). Repolicy enforces standardized `package.json` fields, configuration files, and GitHub Actions workflows across repositories.

## Features

- Automatically set up standardized `package.json` scripts and fields following the Vite+ convention.
- Automatically set up standardized configuration files like `tsconfig-base.json` and `vite.config.ts`.
- Automatically set up GitHub Actions workflows for check/test/build/publish.
- Check if any repo has diverged from the specified policy (due to policy updates or manual changes) and provide automated migration paths to bring the repo back into compliance.

## Design

Instead of using shared config files (which create friction when updating), individual configuration files are **copied directly into a project.** If a project needs to customize a configuration file, it brings the project out of compliance. The expectation is that changes will be incorporated back into the policy to make it more flexible, thus bringing the project back into compliance.

There is a list of **policies** to be _applied_ to a repository. Each is idempotent, meaning they can be run on both new (empty) and existing repos.

Example policies:

- **Package metadata** — Ensures required `package.json` fields like `name`, `version`, `type`, `repository`, `homepage`, `bugs` are set correctly.
- **Managed package.json scripts** — Sets `scripts.build`, `scripts.test`, etc. to Vite+ commands like `vp pack`, `vp test`.
- **Managed files** — Copies skeleton files (`.github/workflows/ci.yml`, `tsconfig-base.json`) into the repository, replacing existing versions.
- **Unwanted files** — Removes obsolete files like `.prettierrc`, `yarn.lock`, old Rush Stack configs.
- **Managed devDependencies** — Ensures specific versions of `vite-plus`, `@changesets/cli`, etc. are installed.
- **Unwanted devDependencies** — Removes old tooling like Jest, Prettier, ESLint that are replaced by Vite+.
- **Package.json fields** — Enforces `files`, `exports`, and removes redundant fields when using modern conventions.

## What to Expect from a Repolicy-Managed Project

- [Vite+](https://viteplus.dev/)-managed toolchain which combines [Rolldown](https://rolldown.rs/), [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Oxfmt](https://oxc.rs/docs/guide/usage/formatter), [Vitest](https://vitest.dev/) into a coherent package
- `vp install` to install dependencies and set up Git hooks
- `vp run build` to build the package
- `vp run dev` to build the package and watch for changes
- `vp run test` to run tests
- `vp run check` to format files and lint code
- Releases managed by [Changesets](https://changesets-docs.vercel.app/), automated by GitHub Actions
- [Trusted publishing](https://docs.npmjs.com/trusted-publishers) with OIDC — no long-lived npm tokens required
- Consistent `tsconfig.json`, `vite.config.ts`, and GitHub Actions workflows across all projects
- Ability to extend base configurations while staying in compliance
- npm packages that include source code and source maps, allowing offline inspection by coding agents and enabling documentation generation via tools like [apiref](https://github.com/dtinth/apiref)

## Installation

Clone the repository and link it locally:

```bash
git clone https://github.com/dtinth/repolicy.git
cd repolicy
pnpm link --global
```

## Usage

### Check repositories for violations

```bash
repolicy check
```

Options:

- `-v, --verbose` - Show detailed violation information and fix descriptions
- `--json` - Output results as JSON

### Auto-fix violations

```bash
repolicy fix
```

Automatically applies all fixable violations in dependency order, checking stability after each fix. Reports violations that require manual intervention.

Options:

- `-v, --verbose` - Show details of each fix applied

### List all policies

```bash
repolicy list
```

## Policies Enforced

### Required Package Dependencies

- `vite-plus@^0.1.14`
- `@changesets/cli@^2.30.0`
- `@typescript/native-preview@7.0.0-dev.20260328.1`

### Required package.json Scripts

- `build` → `vp pack`
- `dev` → `vp pack --watch`
- `test` → `vp test`
- `check` → `vp check`
- `prepublishOnly` → `vp run build`
- `prepare` → `vp config`

### Required package.json Fields

- `files` - Must include `src` and `dist`
- `type` - Must be `module`
- `pnpm.overrides.vite` → `npm:@voidzero-dev/vite-plus-core@latest`
- `pnpm.overrides.vitest` → `npm:@voidzero-dev/vite-plus-test@latest`

### Unwanted package.json Fields

- `main`, `module`, `types`, `docModel` (redundant when using `exports`)

### Managed Skeleton Files

- `.github/workflows/ci.yml` - Parallel jobs for check/test/build
- `.github/workflows/publish.yml` - Trusted publishing with changesets
- `.github/actions/setup/action.yml` - Vite+ project setup
- `tsconfig-base.json` - Base TypeScript configuration
- `vite.config.ts` - Vite configuration

### Old Tooling Removed

- Test frameworks: Jest, Mocha, Chai
- Build tools: Prettier, Tsdown, ESLint
- Release tools: Bumpp, Release-it
- Old package managers: Yarn files
- Old platforms: Rush Stack configuration
- Build artifacts: API extractor output

## Development

```bash
vp install          # Install dependencies
vp check            # Check formatting, linting, and types
vp test             # Run tests
vp pack             # Build the CLI
vp dev              # Watch mode during development
```

## Architecture

- `src/types.ts` - Policy interface and violation types
- `src/policies.ts` - Policy definitions
- `src/runner.ts` - Policy execution engine with stability checking
- `src/cli.ts` - Command-line interface

## License

MIT
