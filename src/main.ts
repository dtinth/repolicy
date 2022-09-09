import { RepolicyContext } from './RepolicyContext'
import { Repo } from './Repo'
import { script } from './script'
import { parseArgs } from 'util'

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  const repoPath = positionals[0]
  if (!repoPath) {
    throw new Error('repo path required')
  }
  const ctx = new RepolicyContext(new Repo(repoPath))
  script(ctx)
  await ctx.run()
}

main()
