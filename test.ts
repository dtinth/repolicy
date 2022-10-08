import { readFileSync } from 'fs'
import { describe, it } from 'node:test'
import assert from 'assert'
import { execa } from 'execa'
import { once } from 'lodash-es'

describe('fresh-lib', () => {
  const ensureCreated = once(async () => {
    const commands = [
      'rm -rf .data/fresh-lib',
      'tsx src/main.ts run -r .data/fresh-lib -e',
    ]
    await execa('bash', ['-exc', commands.join('\n')], {
      stdio: 'inherit',
    })
  })

  it('has a name', async () => {
    await ensureCreated()
    const pkg = JSON.parse(readFileSync('.data/fresh-lib/package.json', 'utf8'))
    assert.equal(pkg.name, 'fresh-lib')
  })

  describe('when built', () => {
    let built = false
    const ensureBuilt = once(async () => {
      await ensureCreated()
      built = true
      await execa(
        'bash',
        ['-exc', 'cd .data/fresh-lib && pnpm install --prefer-offline'],
        { stdio: 'inherit' },
      )
    })

    it('is successful', async () => {
      await ensureBuilt()
    })
  })
})
