import glob from 'glob'

import {
  RepolicyScript,
  RepolicyPlugin,
  RepolicyContext,
} from './RepolicyScript'
import { Repo } from './Repo'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { JSONEditor } from './JSONEditor'
import * as _ from 'lodash-es'
import { PropertyPath } from 'lodash'

const script: RepolicyScript = ({ use }) => {
  use(managedFiles('skeleton'))
  use(
    unwantedFile(
      // Replaced with changeset.
      '.release-it.json',
      '.release-it.yml',

      // Replaced with .prettierrc.yml
      '.prettierrc',

      // Replaced with pnpm
      'package-lock.json',
      'yarn.lock',
    ),
  )

  use(
    packageJsonPolicy('Package has a name', 'name', (name) => name || '!?'),
    packageJsonPolicy('Package has a version', 'version', (v) => v || '0.0.0'),
    packageJsonPolicy('Package has files', 'files', () => [
      'src',
      'lib',
      'lib-commonjs',
      'dist',
    ]),
    packageJsonPolicy(
      'Package has a main entrypoint as CommonJS',
      'main',
      () => './lib-commonjs/index.js',
    ),
    packageJsonPolicy(
      'Package has a module entrypoint',
      'module',
      () => './lib/index.js',
    ),
    packageJsonPolicy(
      'Package has a types entrypoint',
      'types',
      (_value, pkg) => `./dist/${unscopedPackageName(pkg)}.d.ts`,
    ),
    packageJsonPolicy(
      'Package has a docModel',
      'docModel',
      (_value, pkg) => `./dist/${unscopedPackageName(pkg)}.api.json`,
    ),
    packageJsonPolicy(
      'Package does not have "typings" field',
      'typings',
      () => undefined,
    ),
    packageDevDependencies({
      '@rushstack/heft': '0.45.12',
      '@rushstack/heft-web-rig': '0.10.15',
      '@types/heft-jest': '1.0.3',
      prettier: '2.7.1',
      '@changesets/cli': '2.23.0',
      jest: null, // Overridden by @rushstack/heft
      mocha: null, // Overridden by @rushstack/heft
      chai: null, // Overridden by @rushstack/heft
      typescript: null, // Overridden by @rushstack/heft
      'api-documenter-yaml-to-antora-asciidoc': null, // Overridden by apiref.page
      '@microsoft/api-documenter': null, // Overridden by apiref.page
      'news-fragments': null, // Overridden by changeset
      '@spacet.me/news-fragments': null, // Overridden by changeset
      'release-it': null, // Overridden by changeset
    }),
    packageScripts({
      build: 'heft build',
      test: 'heft test',
      prepare: 'heft build && ./scripts/generate-api-docs',
      release: './scripts/release',
      format: 'prettier --write .',
      api: './scripts/generate-api-docs',
    }),
  )
}

/**
 * Ensure that manage files exist.
 */
function managedFiles(templatePath: string): RepolicyPlugin {
  return (context) => {
    const files = glob.sync('**', { cwd: templatePath, dot: true, nodir: true })
    for (const file of files) {
      context.addPolicy(`Managed file "${file}"`, async (repo) => {
        repo.write(file, readFileSync(resolve(templatePath, file)))
      })
    }
  }
}

/**
 * Ensure that a file does not exist.
 */
function unwantedFile(...projectPaths: string[]): RepolicyPlugin {
  return (context) => {
    for (const projectPath of projectPaths) {
      context.addPolicy(`Unwanted file "${projectPath}"`, async (repo) => {
        repo.delete(projectPath)
      })
    }
  }
}

/**
 * Ensure that a file does not exist.
 */
function packageDevDependencies(
  data: Record<string, string | null>,
): RepolicyPlugin {
  return (context) => {
    for (const [name, version] of Object.entries(data)) {
      if (version === null) {
        context.addPolicy(`Unwanted devDependency "${name}"`, async (repo) => {
          _updatePackageJson(repo, ['devDependencies', name], () => undefined)
        })
      } else {
        context.addPolicy(
          `DevDependency "${name}" version "${version}"`,
          async (repo) => {
            _updatePackageJson(repo, ['devDependencies', name], () => version)
          },
        )
      }
    }
  }
}

/**
 * Ensure that a file does not exist.
 */
function packageScripts(data: Record<string, string | null>): RepolicyPlugin {
  return (context) => {
    for (const [name, value] of Object.entries(data)) {
      if (value === null) {
        context.addPolicy(`Unwanted script "${name}"`, async (repo) => {
          _updatePackageJson(repo, ['scripts', name], () => undefined)
        })
      } else {
        context.addPolicy(`Managed package script "${name}"`, async (repo) => {
          _updatePackageJson(repo, ['scripts', name], () => value)
        })
      }
    }
  }
}

/**
 * Ensure that a file does not exist.
 */
function packageJsonPolicy(
  policyName: string,
  field: PropertyPath,
  expected: (value: any, p: any) => any,
): RepolicyPlugin {
  return (context) => {
    context.addPolicy(policyName, async (repo) => {
      _updatePackageJson(repo, field, expected)
    })
  }
}

function _updatePackageJson(
  repo: Repo,
  field: PropertyPath,
  expected: (value: any, p: any) => any,
) {
  const editor = new JSONEditor(repo)
  const pkg = editor.read('package.json')
  const value = _.get(pkg, field)
  const expectedValue = expected(value, pkg)
  editor.edit('package.json', (p) => {
    if (expectedValue === undefined) {
      _.unset(p, field)
    } else {
      _.set(p, field, expectedValue)
    }
  })
}

async function main() {
  const ctx = new RepolicyContext(
    new Repo('/Users/dtinth/Projects/react-performance-coach'),
  )
  script(ctx)
  await ctx.run()
}

function unscopedPackageName(p: any) {
  return (p.name || '').split('/').pop()
}

main()
