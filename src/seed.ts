import type { AppData, Exercise, LoadMode, Routine } from './types'

type SeedRow = [string, number, number, number | null, LoadMode?, string?, number?]
const groups: { id: string; name: string; shortName: string; rows: SeedRow[] }[] = [
  { id: 'push', name: 'Push day', shortName: 'PUSH', rows: [
    ['Incline press machine', 3, 12, 100],
    ['Flat chest press', 3, 12, 60],
    ['Lower flies', 2, 12, 90],
    ['Shoulder press', 2, 12, 30, 'per-hand'],
    ['DB lateral raises', 2, 12, 14, 'per-hand', 'Drop set shown in Notes: 14 kg → 10 kg.', 10],
    ['Triceps pushdown', 2, 12, 50, 'kg', 'Notes show 3 completed sets; target written as 2 sets.'],
    ['Overhead extension', 2, 12, 50, 'kg', 'Notes show 3 completed sets; target written as 2 sets.'],
  ] },
  { id: 'pull', name: 'Pull day', shortName: 'PULL', rows: [
    ['Lat pulldowns CGP', 3, 12, 73],
    ['T-wide grip', 3, 12, 50],
    ['Lower back', 3, 12, 20],
    ['DB rows', 3, 12, 40, 'per-hand', 'Check whether 40 kg is per hand.'],
    ['Preacher curls', 3, 12, 63],
    ['Reverse bar preacher curls', 3, 12, 15],
    ['Crunches', 4, 12, 20],
  ] },
  { id: 'legs', name: 'Leg day', shortName: 'LEGS', rows: [
    ['Sissy squats', 3, 12, 17.5],
    ['DB Romanian deadlift', 3, 12, 26, 'per-hand', 'Check whether 26 kg is per hand.'],
    ['Leg extensions', 3, 12, 63],
    ['Leg curls', 3, 12, 50],
    ['Hip thrusts', 3, 12, 25],
    ['Standing calf raises', 3, 12, 40, 'per-leg'],
  ] },
  { id: 'chest-back', name: 'Chest & Back', shortName: 'CHEST / BACK', rows: [
    ['Pull ups', 3, 12, null, 'bodyweight'],
    ['High to low rows', 3, 12, 40, 'kg', 'Notes show 3 × 10 as latest result.'],
    ['T-wide grip', 3, 12, 50],
    ['Pec-deck flies', 3, 12, 81],
    ['Low to high chest flies', 3, 12, 27, 'per-hand', 'Notes also mention 52 kg per hand on another machine (NMC).'],
    ['Weighted dips', 3, 12, 10, 'added'],
    ['Crunches', 3, 20, 20, 'kg', 'Notes show 2 × 15 as latest result.'],
  ] },
  { id: 'shoulders-arms', name: 'Shoulders & Arms', shortName: 'SHOULDERS / ARMS', rows: [
    ['MC lateral raises', 4, 12, 50, 'kg', 'Notes show 2 × 12 as latest result.'],
    ['Single hand shrugs', 3, 12, 20, 'per-hand'],
    ['Rear delts', 3, 12, 63, 'kg', 'Notes show 2 × 12 as latest result.'],
    ['Triceps pushdown', 3, 12, 41, 'kg', 'Notes show 2 × 12 as latest result.'],
    ['Triceps kickbacks', 3, 12, null, 'per-hand', 'Weight was not visible in Notes.'],
    ['Preacher reverse curls', 3, 12, 17.5, 'kg', 'Notes show 2 × 12 as latest result.'],
    ['Preacher curls', 3, 12, 63, 'kg', 'Notes show 2 × 12 as latest result.'],
  ] },
]

export function makeSeed(): AppData {
  const routines: Routine[] = groups.map(group => ({ id: group.id, name: group.name, shortName: group.shortName, exerciseIds: group.rows.map((_, i) => `${group.id}-${i}`) }))
  const exercises: Exercise[] = groups.flatMap(group => group.rows.map(([name, targetSets, targetReps, startingWeight, mode = 'kg', note = '', startingDropWeight], i) => ({
    id: `${group.id}-${i}`, routineId: group.id, name, targetSets, targetReps, startingWeight, mode, note,
    ...(startingDropWeight !== undefined ? { startingDropWeight } : {}),
  })))
  return { schemaVersion: 1, routines, exercises, sessions: [], settings: { restSeconds: 90 } }
}
