import type { AppData, Exercise, LoadMode, Session, SetEntry } from './types'

export const uid = () => crypto.randomUUID()

export const modeLabels: Record<LoadMode, string> = {
  kg: 'total / machine',
  'per-hand': 'per hand',
  'per-leg': 'per leg',
  bodyweight: 'bodyweight',
  added: 'added weight',
}

export function weightText(weight: number | null, mode: LoadMode): string {
  if (mode === 'bodyweight') return 'Bodyweight'
  if (weight === null) return 'Set weight'
  return `${mode === 'added' ? '+' : ''}${weight} kg${mode === 'per-hand' ? ' / hand' : mode === 'per-leg' ? ' / leg' : ''}`
}

export function lastSessionFor(exerciseId: string, sessions: Session[]): Session | undefined {
  return sessions.filter(s => s.endedAt && s.exerciseSnapshots.some(e => e.id === exerciseId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export function getSuggestion(exercise: Exercise, sessions: Session[]): { weight: number | null; ready: boolean; hasHistory: boolean } {
  const last = lastSessionFor(exercise.id, sessions)
  if (!last) return { weight: exercise.startingWeight, ready: false, hasHistory: false }
  const snapshot = last.exerciseSnapshots.find(e => e.id === exercise.id)!
  const planned = last.sets.filter(s => s.exerciseId === exercise.id && s.ordinal <= snapshot.targetSets)
  const complete = planned.length >= snapshot.targetSets && planned.every(s => s.completedAt && s.reps >= snapshot.targetReps)
  if (exercise.mode === 'bodyweight') return { weight: null, ready: Boolean(complete), hasHistory: true }
  const completedWeights = planned.filter(s => s.completedAt && s.weight !== null).map(s => s.weight as number)
  const lastWorkingWeight = completedWeights.length ? Math.min(...completedWeights) : planned[0]?.weight ?? exercise.startingWeight
  const allWeighted = planned.length >= snapshot.targetSets && planned.every(s => s.completedAt && s.weight !== null)
  return {
    weight: lastWorkingWeight === null || lastWorkingWeight === undefined ? null : Math.round((lastWorkingWeight + (complete && allWeighted ? 2.5 : 0)) * 100) / 100,
    ready: Boolean(complete && allWeighted),
    hasHistory: true,
  }
}

export function createSession(data: AppData, routineId: string): Session {
  const routine = data.routines.find(r => r.id === routineId)
  if (!routine) throw new Error('Routine not found')
  const exercises = routine.exerciseIds.map(id => data.exercises.find(e => e.id === id)).filter((e): e is Exercise => Boolean(e))
  const snapshots = exercises.map(e => ({ id: e.id, name: e.name, targetSets: e.targetSets, targetReps: e.targetReps, mode: e.mode }))
  const sets: SetEntry[] = exercises.flatMap(e => Array.from({ length: e.targetSets }, (_, i) => ({
    id: uid(), exerciseId: e.id, ordinal: i + 1, reps: e.targetReps,
    weight: getSuggestion(e, data.sessions).weight, dropReps: null, dropWeight: null, completedAt: null,
  })))
  return { id: uid(), routineId, routineName: routine.name, startedAt: new Date().toISOString(), endedAt: null, exerciseSnapshots: snapshots, sets }
}

export function activeSession(data: AppData): Session | undefined {
  return data.sessions.find(s => s.endedAt === null)
}

export function sessionProgress(session: Session): { done: number; total: number } {
  return { done: session.sets.filter(s => s.completedAt).length, total: session.sets.length }
}

export function validateBackup(input: unknown): AppData {
  const obj = input as AppData
  if (!obj || typeof obj !== 'object' || obj.schemaVersion !== 1 || !Array.isArray(obj.routines) || !Array.isArray(obj.exercises) || !Array.isArray(obj.sessions) || !obj.settings || typeof obj.settings.restSeconds !== 'number') throw new Error('This is not a Forge backup (version 1).')
  if (!obj.routines.every(r => typeof r.id === 'string' && typeof r.name === 'string' && typeof r.shortName === 'string' && Array.isArray(r.exerciseIds) && r.exerciseIds.every(id => typeof id === 'string'))) throw new Error('The backup has invalid routines.')
  if (!obj.exercises.every(e => typeof e.id === 'string' && typeof e.routineId === 'string' && typeof e.name === 'string' && Number.isInteger(e.targetSets) && e.targetSets > 0 && Number.isInteger(e.targetReps) && e.targetReps > 0 && (e.startingWeight === null || typeof e.startingWeight === 'number') && Object.keys(modeLabels).includes(e.mode) && typeof e.note === 'string')) throw new Error('The backup has invalid exercises.')
  if (!obj.sessions.every(s => typeof s.id === 'string' && typeof s.routineId === 'string' && typeof s.routineName === 'string' && typeof s.startedAt === 'string' && (s.endedAt === null || typeof s.endedAt === 'string') && Array.isArray(s.exerciseSnapshots) && s.exerciseSnapshots.every(e => typeof e.id === 'string' && typeof e.name === 'string' && Number.isInteger(e.targetSets) && Number.isInteger(e.targetReps) && Object.keys(modeLabels).includes(e.mode)) && Array.isArray(s.sets) && s.sets.every(set => typeof set.id === 'string' && typeof set.exerciseId === 'string' && Number.isInteger(set.ordinal) && typeof set.reps === 'number' && (set.weight === null || typeof set.weight === 'number') && (set.dropReps === null || typeof set.dropReps === 'number') && (set.dropWeight === null || typeof set.dropWeight === 'number') && (set.completedAt === null || typeof set.completedAt === 'string')))) throw new Error('The backup has invalid workouts.')
  const unique = <T extends { id: string }>(rows: T[]) => new Set(rows.map(row => row.id)).size === rows.length
  if (!unique(obj.routines) || !unique(obj.exercises) || !unique(obj.sessions)) throw new Error('The backup contains duplicate records.')
  return obj
}
