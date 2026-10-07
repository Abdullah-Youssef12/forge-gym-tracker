import { describe, expect, it } from 'vitest'
import { createSession, getSuggestion, validateBackup } from './logic'
import { makeSeed } from './seed'

describe('progression', () => {
  it('starts with screenshot weights without inventing history', () => {
    const data = makeSeed()
    expect(data.sessions).toHaveLength(0)
    const session = createSession(data, 'push')
    expect(session.sets.filter(s => s.exerciseId === 'push-0').map(s => s.weight)).toEqual([100, 100, 100])
  })

  it('adds 2.5 kg only after every planned set reaches the target', () => {
    const data = makeSeed()
    const exercise = data.exercises.find(e => e.id === 'push-0')!
    const session = createSession(data, 'push')
    session.sets.filter(s => s.exerciseId === exercise.id).forEach(s => { s.completedAt = new Date().toISOString(); s.reps = 12 })
    session.endedAt = new Date().toISOString()
    expect(getSuggestion(exercise, [session]).weight).toBe(102.5)
    session.sets.find(s => s.exerciseId === exercise.id)!.reps = 11
    expect(getSuggestion(exercise, [session]).weight).toBe(100)
  })

  it('marks bodyweight progress without assigning a weight', () => {
    const data = makeSeed()
    const exercise = data.exercises.find(e => e.id === 'chest-back-0')!
    const session = createSession(data, 'chest-back')
    session.sets.filter(s => s.exerciseId === exercise.id).forEach(s => { s.completedAt = new Date().toISOString() })
    session.endedAt = new Date().toISOString()
    expect(getSuggestion(exercise, [session])).toEqual({ weight: null, ready: true, hasHistory: true })
  })

  it('ignores a drop portion and an extra set when checking planned work', () => {
    const data = makeSeed()
    const exercise = data.exercises.find(e => e.id === 'push-4')!
    const session = createSession(data, 'push')
    const planned = session.sets.filter(s => s.exerciseId === exercise.id)
    planned.forEach(s => { s.completedAt = new Date().toISOString(); s.reps = 12; s.dropReps = 8; s.dropWeight = 10 })
    session.sets.push({ ...planned[0], id: 'extra', ordinal: 3, reps: 5, completedAt: new Date().toISOString() })
    session.endedAt = new Date().toISOString()
    expect(getSuggestion(exercise, [session]).weight).toBe(16.5)
  })
})

describe('backup', () => {
  it('accepts a full round trip and rejects an unsupported version', () => {
    const seed = makeSeed()
    expect(validateBackup(JSON.parse(JSON.stringify(seed)))).toEqual(seed)
    expect(() => validateBackup({ ...seed, schemaVersion: 2 })).toThrow()
  })
})
