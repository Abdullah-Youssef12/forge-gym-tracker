export type LoadMode = 'kg' | 'per-hand' | 'per-leg' | 'bodyweight' | 'added'

export interface Routine {
  id: string
  name: string
  shortName: string
  exerciseIds: string[]
}

export interface Exercise {
  id: string
  routineId: string
  name: string
  targetSets: number
  targetReps: number
  startingWeight: number | null
  mode: LoadMode
  note: string
  startingDropWeight?: number | null
}

export interface ExerciseSnapshot {
  id: string
  name: string
  targetSets: number
  targetReps: number
  mode: LoadMode
}

export interface SetEntry {
  id: string
  exerciseId: string
  ordinal: number
  reps: number
  weight: number | null
  dropReps: number | null
  dropWeight: number | null
  completedAt: string | null
}

export interface Session {
  id: string
  routineId: string
  routineName: string
  startedAt: string
  endedAt: string | null
  exerciseSnapshots: ExerciseSnapshot[]
  sets: SetEntry[]
}

export interface AppData {
  schemaVersion: 1
  routines: Routine[]
  exercises: Exercise[]
  sessions: Session[]
  settings: { restSeconds: number }
}
