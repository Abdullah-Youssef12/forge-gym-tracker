import Dexie, { type Table } from 'dexie'
import type { AppData } from './types'
import { makeSeed } from './seed'

type StateRow = { id: string; value: AppData }
class ForgeDatabase extends Dexie {
  state!: Table<StateRow, string>
  constructor() {
    super('forge-gym')
    this.version(1).stores({ state: 'id' })
  }
}
const db = new ForgeDatabase()
let queue: Promise<unknown> = Promise.resolve()

export async function loadData(): Promise<AppData> {
  const row = await db.state.get('main')
  if (row) return row.value
  const seed = makeSeed()
  await db.state.put({ id: 'main', value: seed })
  return seed
}

export function persistData(value: AppData): Promise<void> {
  const next = queue.catch(() => undefined).then(() => db.state.put({ id: 'main', value })).then(() => undefined)
  queue = next
  return next
}

export async function waitForSaves(): Promise<void> {
  await queue
}
