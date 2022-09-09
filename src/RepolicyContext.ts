import chalk from 'chalk'
import { Repo } from './Repo'

class Policy {
  constructor(
    public readonly name: string,
    public readonly f?: PolicyFunction,
  ) {}
}
type PolicyFunction = (repo: Repo) => Promise<void>

export class RepolicyContext {
  constructor(public repo: Repo) {}
  policies: Policy[] = []
  use = (...plugins: RepolicyPlugin[]) => {
    plugins.forEach((plugin) => {
      plugin(this)
    })
  }
  addPolicy = (name: string, fn?: PolicyFunction) => {
    this.policies.push(new Policy(name, fn))
  }
  run = async () => {
    for (const policy of this.policies) {
      if (policy.f) {
        const oldVersion = this.repo.version
        await policy.f(this.repo)
        if (oldVersion !== this.repo.version) {
          console.log(`[${chalk.yellow('update')}] ${policy.name}`)
        } else {
          console.log(`[${chalk.green('ok')}] ${policy.name}`)
        }
      } else {
        console.log(`[${chalk.magenta('todo')}] ${policy.name}`)
      }
    }
  }
  flush = async () => {
    this.repo.flush()
  }
}

export type RepolicyPlugin = (context: RepolicyContext) => void
