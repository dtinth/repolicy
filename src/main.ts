import { RepolicyContext } from './RepolicyContext'
import { Repo } from './Repo'
import { script } from './script'
import { parseArgs } from 'util'

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      flush: { type: 'boolean', short: 'f' },
    },
  })
  const repoPath = positionals[0]
  if (!repoPath) {
    throw new Error('repo path required')
  }
  const ctx = new RepolicyContext(new Repo(repoPath))
  await script(ctx)
  await ctx.run()
  if (values.flush) {
    await ctx.flush()
  }
}

main()
