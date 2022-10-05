import {
  CommandLineAction,
  CommandLineFlagParameter,
  CommandLineStringParameter,
} from '@rushstack/ts-command-line'
import { RepolicyContext } from './RepolicyContext'
import { Repo } from './Repo'
import { script } from './script'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { load } from 'js-yaml'
import { z } from 'zod'
import { execa } from 'execa'

const yamlSchema = z.object({
  repos: z.array(
    z.object({
      repo: z.string().url(),
    }),
  ),
})

export class RunAllCommandLineAction extends CommandLineAction {
  private _listFile!: CommandLineStringParameter
  private _enforce!: CommandLineFlagParameter
  public constructor() {
    super({
      actionName: 'run-all',
      summary:
        'Checks and enforces policies on multiple repositories from a list file.',
      documentation:
        'Checks and enforces policies on multiple repositories from a list file. ' +
        'The list file is expected be a YAML file that contains GitHub repo URLs. ' +
        'This command will check out the repositories in the list and checks the policies.',
    })
  }
  protected onDefineParameters(): void {
    this._listFile = this.defineStringParameter({
      parameterLongName: '--list-file',
      parameterShortName: '-f',
      argumentName: 'FILE',
      description: 'Path to the YAML file containing list of repositories.',
      required: true,
    })
    this._enforce = this.defineFlagParameter({
      parameterLongName: '--enforce',
      parameterShortName: '-e',
      description: 'Enforce the policies.',
    })
  }
  protected async onExecute(): Promise<void> {
    const listFilePath = this._listFile.value!
    const enforce = this._enforce.value
    const listFileContents = yamlSchema.parse(
      load(readFileSync(listFilePath, 'utf8')),
    )
    const results: {
      repo: string
      total: number
      ok: number
      update: number
    }[] = []
    for (const item of listFileContents.repos) {
      const url = item.repo
      console.log(``)
      console.log(`# ${url}`)
      const parts = new URL(url).pathname
        .replace(/\.git$/, '')
        .replace(/^\//, '')
        .split('/')
      if (parts.length !== 2) {
        throw new Error(`Invalid repo URL: ${url}`)
      }
      const [owner, repo] = parts
      mkdirSync(`.data/repos/${owner}`, { recursive: true })
      const repoPath = `.data/repos/${owner}/${repo}`
      if (!existsSync(repoPath)) {
        const repoUrl = process.env.GH_PUSH_TOKEN
          ? url.replace(
              '://',
              `://x-access-token:${process.env.GH_PUSH_TOKEN}@`,
            )
          : url
        await execa(`git clone '${repoUrl}' '${repoPath}'`, {
          shell: true,
          stdio: 'inherit',
        })
      }
      let stats = {
        total: 0,
        ok: 0,
        update: 0,
      }
      const ctx = new RepolicyContext(new Repo(listFilePath), {
        onPolicyEvaluated(_policy, status) {
          stats.total++
          if (status === 'ok') {
            stats.ok++
          } else if (status === 'update') {
            stats.update++
          }
        },
      })
      await script(ctx)
      await ctx.run()
      if (enforce) {
        await ctx.flush()
      }
      results.push({
        repo: `${owner}/${repo}`,
        ...stats,
      })
    }
    console.table(results)
  }
}
