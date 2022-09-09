import { isEqual } from 'lodash-es'
import type { Repo } from './Repo'

export class JSONEditor {
  constructor(public repo: Repo) {}
  edit(path: string, f: (data: any) => any) {
    const data = this.read(path)
    const oldData = JSON.parse(JSON.stringify(data))
    const newData = f(data) || data
    if (!isEqual(oldData, newData)) {
      this.repo.write(path, Buffer.from(JSON.stringify(newData, null, 2)))
    }
    return newData
  }
  read(path: string) {
    return JSON.parse(this.repo.read(path)?.toString() || '{}')
  }
  write(path: string, data: any) {
    return this.edit(path, () => data)
  }
}
