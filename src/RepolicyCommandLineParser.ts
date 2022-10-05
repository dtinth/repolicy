import { CommandLineParser } from '@rushstack/ts-command-line'
import { RunCommandLineAction } from './RunCommandLineAction'

export class RepolicyCommandLineParser extends CommandLineParser {
  public constructor() {
    super({
      toolFilename: 'repolicy',
      toolDescription: 'Checks and enforces policies on a repository.',
    })
    this.addAction(new RunCommandLineAction())
  }
  protected onDefineParameters(): void {}
}
