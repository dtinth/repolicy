import {
  CommandLineAction,
  CommandLineFlagParameter,
  CommandLineStringParameter,
} from '@rushstack/ts-command-line'
import { RepolicyContext } from './RepolicyContext'
import { Repo } from './Repo'
import { script } from './script'

export class RunCommandLineAction extends CommandLineAction {
  private _repo!: CommandLineStringParameter
  private _enforce!: CommandLineFlagParameter
  public constructor() {
    super({
      actionName: 'run',
      summary: 'Checks and enforces policies on a repository.',
      documentation: 'Checks and enforces policies on a repository.',
    })
  }
  protected onDefineParameters(): void {
    this._repo = this.defineStringParameter({
      parameterLongName: '--repo',
      parameterShortName: '-r',
      argumentName: 'REPO',
      description: 'Path to the repository to check.',
      required: true,
    })
    this._enforce = this.defineFlagParameter({
      parameterLongName: '--enforce',
      parameterShortName: '-e',
      description: 'Enforce the policies.',
    })
  }
  protected async onExecute(): Promise<void> {
    const repoPath = this._repo.value!
    const enforce = this._enforce.value
    const ctx = new RepolicyContext(new Repo(repoPath))
    await script(ctx)
    await ctx.run()
    if (enforce) {
      await ctx.flush()
    }
  }
}
