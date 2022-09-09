import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

export class Repo {
  private vfs = new Map<string, FileSystemEntryState>()
  version = 0
  constructor(public readonly basePath: string) {}

  private getEntry(path: string) {
    const fullPath = resolve(this.basePath, path)
    if (!this.vfs.has(path)) {
      this.vfs.set(path, {
        contents: existsSync(fullPath) ? readFileSync(fullPath) : null,
      })
    }
    return this.vfs.get(path)!
  }
  exists(path: string) {
    return !!this.getEntry(path).contents
  }
  read(path: string) {
    return this.getEntry(path).contents
  }
  write(path: string, buf: Buffer | null) {
    const entry = this.getEntry(path)
    const oldBuf = entry.contents
    if (
      buf !== oldBuf &&
      (buf === null || oldBuf === null || !buf.equals(oldBuf))
    ) {
      entry.contents = buf
      this.version++
    }
  }
  delete(path: string) {
    this.write(path, null)
  }
}

export interface FileSystemEntryState {
  contents: Buffer | null
}
