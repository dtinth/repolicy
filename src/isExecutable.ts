import { statSync } from 'fs'

export function isExecutable(fullPath: string) {
  return !!(statSync(fullPath).mode & 0o111)
}
