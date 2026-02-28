import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

export async function createTestDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mat-test-'))
}

export async function removeTestDir(dir: string): Promise<void> {
  await rm(dir, {recursive: true, force: true})
}
