import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock3, Download, Dumbbell, FileUp, Flame, History, Home, Plus, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { activeSession, createSession, getSuggestion, lastSessionFor, modeLabels, sessionProgress, uid, validateBackup, weightText } from './logic'
import { loadData, persistData, waitForSaves } from './storage'
import type { AppData, Exercise, LoadMode, SetEntry } from './types'

type View = 'home' | 'session' | 'history' | 'detail' | 'progress' | 'settings' | 'editor'
const dateLabel = (iso: string, opts?: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const num = (value: string): number | null => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null
const weekStart = () => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d.getTime() }

function MiniChart({ values, labels, unit }: { values: number[]; labels: string[]; unit: string }) {
  if (!values.length) return <div className="chart-empty"><BarChart3 size={24} /><span>Your first logged session will start the chart.</span></div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const points = values.map((v, i) => ({ x: values.length === 1 ? 50 : 7 + i * 86 / (values.length - 1), y: 75 - (v - min) / range * 55 }))
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  return <div className="chart-wrap">
    <div className="chart-head"><span>RECENT PERFORMANCE</span><strong>{values.at(-1)} <small>{unit}</small></strong></div>
    <svg className="chart" viewBox="0 0 100 95" role="img" aria-label={`Performance over time: ${values.join(', ')} ${unit}`} preserveAspectRatio="none">
      <line x1="7" y1="75" x2="93" y2="75" className="chart-grid" /><line x1="7" y1="47" x2="93" y2="47" className="chart-grid" /><line x1="7" y1="20" x2="93" y2="20" className="chart-grid" />
      <path d={path} fill="none" className="chart-line" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.7" className="chart-dot" />)}
    </svg>
    <div className="chart-dates"><span>{labels[0]}</span><span>{labels.at(-1)}</span></div>
  </div>
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const dataRef = useRef<AppData | null>(null)
  const [view, setView] = useState<View>('home')
  const [editingRoutineId, setEditingRoutineId] = useState('push')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [progressExerciseId, setProgressExerciseId] = useState('push-0')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restUntil, setRestUntil] = useState<number>(() => Number(localStorage.getItem('forge-rest-until') || 0))
  const [now, setNow] = useState(Date.now())
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData().then(value => { dataRef.current = value; setData(value); if (activeSession(value)) setView('session') }).catch(error => setLoadError(String(error))) }, [])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (message) { const timer = window.setTimeout(() => setMessage(null), 3500); return () => window.clearTimeout(timer) } }, [message])

  const update = (change: (draft: AppData) => void) => {
    if (!dataRef.current) return
    const next = structuredClone(dataRef.current)
    change(next)
    dataRef.current = next
    setData(next)
    void persistData(next).catch(() => setMessage('Could not save. Check your iPhone storage.'))
  }
  const replace = (next: AppData) => { dataRef.current = next; setData(next); void persistData(next).catch(() => setMessage('Could not save the imported backup.')) }
  const navigate = (next: View) => { window.scrollTo({ top: 0, behavior: 'smooth' }); setView(next) }
  const restStart = () => { if (!data?.settings.restSeconds) return; const until = Date.now() + data.settings.restSeconds * 1000; setRestUntil(until); localStorage.setItem('forge-rest-until', String(until)) }
  const restStop = () => { setRestUntil(0); localStorage.removeItem('forge-rest-until') }
  const restAdd = () => { const until = Math.max(restUntil, Date.now()) + 30_000; setRestUntil(until); localStorage.setItem('forge-rest-until', String(until)) }
  const remaining = Math.max(0, Math.ceil((restUntil - now) / 1000))
  const current = data ? activeSession(data) : undefined

  const start = (routineId: string) => {
    if (!data) return
    if (current) { navigate('session'); return }
    const session = createSession(data, routineId)
    update(d => { d.sessions.unshift(session) })
    setExpandedId(session.exerciseSnapshots[0]?.id ?? null)
    navigate('session')
  }
  const setField = (sessionId: string, setId: string, field: keyof SetEntry, value: number | null) => update(d => {
    const set = d.sessions.find(s => s.id === sessionId)?.sets.find(s => s.id === setId)
    if (set && (field === 'reps' || field === 'weight' || field === 'dropReps' || field === 'dropWeight')) (set as unknown as Record<string, unknown>)[field] = value
  })
  const toggleSet = (sessionId: string, setId: string) => {
    const entry = data?.sessions.find(s => s.id === sessionId)?.sets.find(s => s.id === setId)
    if (!entry) return
    const mode = data?.sessions.find(s => s.id === sessionId)?.exerciseSnapshots.find(e => e.id === entry.exerciseId)?.mode
    if (!entry.completedAt && (entry.reps <= 0 || (entry.weight === null && mode !== 'bodyweight') || (entry.dropReps !== null && (entry.dropReps <= 0 || entry.dropWeight === null)))) { setMessage('Enter reps and weight before completing the set.'); return }
    update(d => { const set = d.sessions.find(s => s.id === sessionId)!.sets.find(s => s.id === setId)!; set.completedAt = set.completedAt ? null : new Date().toISOString() })
    if (!entry.completedAt) restStart()
  }
  const toggleDrop = (sessionId: string, setId: string, exercise: Exercise | undefined, targetReps: number) => update(d => {
    const set = d.sessions.find(s => s.id === sessionId)!.sets.find(s => s.id === setId)!
    if (set.dropReps !== null) { set.dropReps = null; set.dropWeight = null }
    else { set.dropReps = targetReps; set.dropWeight = exercise?.startingDropWeight ?? (set.weight === null ? null : Math.max(0, set.weight - 2.5)) }
  })
  const addSet = (sessionId: string, exerciseId: string, targetReps: number) => update(d => {
    const session = d.sessions.find(s => s.id === sessionId)!
    const sets = session.sets.filter(s => s.exerciseId === exerciseId)
    session.sets.push({ id: uid(), exerciseId, ordinal: Math.max(...sets.map(s => s.ordinal), 0) + 1, reps: targetReps, weight: sets.at(-1)?.weight ?? null, dropReps: null, dropWeight: null, completedAt: null })
  })
  const finish = () => {
    if (!current) return
    if (!current.sets.some(s => s.completedAt) && !window.confirm('Finish this workout with no completed sets?')) return
    update(d => { d.sessions.find(s => s.id === current.id)!.endedAt = new Date().toISOString() })
    restStop(); setMessage('Workout saved. Nice work.'); navigate('home')
  }
  const discard = () => { if (!current || !window.confirm('Discard this workout and all its sets?')) return; update(d => { d.sessions = d.sessions.filter(s => s.id !== current.id) }); restStop(); navigate('home') }

  const exportBackup = async () => {
    if (!dataRef.current) return
    try {
      await waitForSaves()
      const date = new Date().toISOString().slice(0, 10)
      const file = new File([JSON.stringify(dataRef.current, null, 2)], `forge-backup-${date}.json`, { type: 'application/json' })
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Forge backup' })
      else { const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 5000) }
      setMessage('Backup ready. Save it in Files or another safe place.')
    } catch (error) { if ((error as DOMException).name !== 'AbortError') setMessage('Backup could not be created.') }
  }
  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = validateBackup(JSON.parse(await file.text()))
      if (!window.confirm(`Replace this phone's data with ${parsed.sessions.length} workouts and ${parsed.routines.length} routines from the backup? This cannot be undone without a current backup.`)) return
      replace(parsed); setMessage('Backup restored.'); navigate('home')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read backup.') }
    if (fileInput.current) fileInput.current.value = ''
  }

  if (loadError) return <div className="fatal"><h1>Forge could not open</h1><p>{loadError}</p><button onClick={() => location.reload()}>Try again</button></div>
  if (!data) return <div className="loading"><div className="brand-mark">F</div><p>Loading your training space…</p></div>
  const completed = data.sessions.filter(s => s.endedAt)
  const thisWeek = completed.filter(s => new Date(s.startedAt).getTime() >= weekStart()).length
  const totalSets = completed.flatMap(s => s.sets).filter(s => s.completedAt).length
  const editingRoutine = data.routines.find(r => r.id === editingRoutineId) ?? data.routines[0]
  const detail = data.sessions.find(s => s.id === detailId)
  const progressExercise = data.exercises.find(e => e.id === progressExerciseId) ?? data.exercises[0]
  const chartSessions = completed.filter(s => s.sets.some(set => set.exerciseId === progressExercise?.id && set.completedAt)).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(-8)
  const chartValues = chartSessions.map(s => {
    const sets = s.sets.filter(set => set.exerciseId === progressExercise?.id && set.completedAt)
    return progressExercise?.mode === 'bodyweight' ? Math.max(0, ...sets.map(set => set.reps)) : Math.max(0, ...sets.map(set => set.weight ?? 0))
  })

  return <div className={`app-shell ${view === 'session' ? 'is-session' : ''}`}>
    <header className="topbar"><button className="wordmark" onClick={() => navigate('home')} aria-label="Forge home"><span className="brand-mark">F</span><span>FORGE<span className="wordmark-dot">.</span></span></button><div className="topbar-right"><span className="topbar-date">{dateLabel(new Date().toISOString(), { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="avatar">GYM</span></div></header>

    {view === 'home' && <main className="page home-page">
      <div className="eyebrow"><span className="eyebrow-line" /> YOUR TRAINING SPACE</div>
      <section className="hero"><div className="hero-copy"><div className="hero-kicker"><Flame size={15} /> BUILT ONE REP AT A TIME</div><h1>KEEP<br /><em>SHOWING UP.</em></h1><p>Your progress has a place now. Pick a session, lift, and let Forge remember the rest.</p><button className="hero-action" disabled={!current && !data.routines[0]} onClick={() => current ? navigate('session') : data.routines[0] && start(data.routines[0].id)}><span>{current ? 'Resume workout' : data.routines[0] ? `Start ${data.routines[0].name}` : 'Add a training day'}</span><ArrowRight size={20} /></button></div><div className="hero-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="art-line">F</div><span className="art-caption">PROGRESS / IN MOTION</span></div></section>
      <div className="stats"><div><span>THIS WEEK</span><strong>{thisWeek.toString().padStart(2, '0')}</strong><small>workouts</small></div><div><span>ALL TIME</span><strong>{completed.length.toString().padStart(2, '0')}</strong><small>sessions</small></div><div><span>SETS LOGGED</span><strong>{totalSets.toString().padStart(2, '0')}</strong><small>reps of effort</small></div></div>
      {current && <button className="resume-card" onClick={() => navigate('session')}><div className="pulse-dot" /><div><strong>Workout in progress</strong><span>{current.routineName} · {sessionProgress(current).done}/{sessionProgress(current).total} sets complete</span></div><ArrowRight size={20} /></button>}
      <div className="section-heading"><div><span className="section-index">01 / YOUR SPLIT</span><h2>Choose your session</h2><p>Five training days, always ready when you are.</p></div><button className="text-action" onClick={() => navigate('editor')}><SlidersHorizontal size={16} /> Edit split</button></div>
      <div className="routine-grid">{data.routines.map((routine, i) => { const last = completed.find(s => s.routineId === routine.id); return <button className="routine-card" key={routine.id} onClick={() => start(routine.id)}><div className="routine-card-top"><span className="routine-number">0{i + 1}</span><span className="routine-arrow"><ArrowRight size={20} /></span></div><div><span className="routine-short">{routine.shortName}</span><h3>{routine.name}</h3><div className="routine-meta"><Dumbbell size={15} /> {routine.exerciseIds.length} exercises <span>·</span> {last ? `Last ${dateLabel(last.startedAt, { month: 'short', day: 'numeric' })}` : 'Ready to start'}</div></div></button> })}</div>
      <div className="quiet-note"><ShieldCheck size={17} /> Your workout data stays on this device. Export a backup in Settings.</div>
    </main>}

    {view === 'session' && current && <main className="page session-page">
      <div className="session-top"><button className="icon-button" onClick={() => navigate('home')} aria-label="Back to home"><ArrowLeft size={20} /></button><span className="session-label">LIVE WORKOUT <span className="live-dot" /></span><button className="more-button" onClick={discard}><Trash2 size={16} /> Discard</button></div>
      <div className="session-heading"><span className="section-index">{dateLabel(current.startedAt, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</span><h1>{current.routineName}<span className="accent-period">.</span></h1><p>One set at a time. Your work saves as you go.</p></div>
      <div className="session-progress"><div><strong>{sessionProgress(current).done}<span> / {sessionProgress(current).total}</span></strong><small>SETS COMPLETE</small></div><div className="progress-track"><span style={{ width: `${sessionProgress(current).total ? sessionProgress(current).done / sessionProgress(current).total * 100 : 0}%` }} /></div></div>
      <div className="exercise-stack">{current.exerciseSnapshots.map((snap, i) => {
        const exercise = data.exercises.find(e => e.id === snap.id)
        const sets = current.sets.filter(s => s.exerciseId === snap.id).sort((a, b) => a.ordinal - b.ordinal)
        const done = sets.filter(s => s.completedAt).length
        const last = lastSessionFor(snap.id, data.sessions)
        const previous = last?.sets.filter(s => s.exerciseId === snap.id && s.completedAt)
        const isOpen = expandedId === snap.id || (!expandedId && i === 0)
        return <section className={`exercise-card ${isOpen ? 'open' : ''}`} key={snap.id}>
          <button className="exercise-card-head" onClick={() => setExpandedId(isOpen ? '' : snap.id)} aria-expanded={isOpen}><span className="exercise-index">{String(i + 1).padStart(2, '0')}</span><span className="exercise-title"><strong>{snap.name}</strong><small>{snap.targetSets} SETS × {snap.targetReps} REPS {exercise?.mode && exercise.mode !== 'kg' ? `· ${modeLabels[exercise.mode].toUpperCase()}` : ''}</small></span><span className="exercise-done">{done}/{sets.length}</span><ChevronDown className="chevron" size={19} /></button>
          {isOpen && <div className="exercise-body"><div className="previous"><History size={14} /> {previous?.length ? `Last time: ${previous.map(s => `${s.reps} × ${weightText(s.weight, snap.mode)}`).join(' · ')}` : `Starting point: ${weightText(exercise?.startingWeight ?? null, snap.mode)}`}</div>
            {exercise?.note && <p className="exercise-note">{exercise.note}</p>}
            <div className="set-labels"><span>SET</span><span>REPS</span><span>{snap.mode === 'bodyweight' ? 'LOAD' : 'KG'}</span><span>DONE</span></div>
            {sets.map(set => <div className={`set-row-wrap ${set.completedAt ? 'set-complete' : ''}`} key={set.id}><div className="set-row"><span className="set-number">{String(set.ordinal).padStart(2, '0')}{set.ordinal > snap.targetSets && <i> EXTRA</i>}</span><input aria-label={`${snap.name} set ${set.ordinal} reps`} type="number" inputMode="numeric" min="0" max="999" value={set.reps} onChange={e => setField(current.id, set.id, 'reps', Math.max(0, Number(e.target.value) || 0))} />{snap.mode === 'bodyweight' ? <span className="bw-label">BW</span> : <div className="weight-input">{snap.mode === 'added' && <span>+</span>}<input aria-label={`${snap.name} set ${set.ordinal} weight in kilograms`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="—" value={set.weight ?? ''} onChange={e => setField(current.id, set.id, 'weight', num(e.target.value))} /></div>}<button className={`check-button ${set.completedAt ? 'checked' : ''}`} onClick={() => toggleSet(current.id, set.id)} aria-label={`${set.completedAt ? 'Undo' : 'Complete'} ${snap.name} set ${set.ordinal}`}>{set.completedAt ? <Check size={20} /> : <Circle size={23} />}</button></div>
              {set.dropReps !== null && <div className="drop-row"><span>↳ DROP</span><input aria-label={`${snap.name} set ${set.ordinal} drop reps`} type="number" inputMode="numeric" min="0" value={set.dropReps} onChange={e => setField(current.id, set.id, 'dropReps', Math.max(0, Number(e.target.value) || 0))} /><div className="weight-input"><input aria-label={`${snap.name} set ${set.ordinal} drop weight in kilograms`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="kg" value={set.dropWeight ?? ''} onChange={e => setField(current.id, set.id, 'dropWeight', num(e.target.value))} /></div><button className="tiny-remove" onClick={() => toggleDrop(current.id, set.id, exercise, snap.targetReps)} aria-label="Remove drop set"><X size={17} /></button></div>}
              {snap.mode !== 'bodyweight' && set.dropReps === null && <button className="drop-add" onClick={() => toggleDrop(current.id, set.id, exercise, snap.targetReps)}>+ Add drop to set {set.ordinal}</button>}
            </div>)}
            <button className="add-set" onClick={() => addSet(current.id, snap.id, snap.targetReps)}><Plus size={16} /> Add extra set</button>
          </div>}
        </section>
      })}</div>
      <div className="session-bottom"><button className="finish-button" onClick={finish}>Finish workout <CheckCircle2 size={20} /></button></div>
      {remaining > 0 && <div className="rest-pill"><div className="rest-icon"><Clock3 size={19} /></div><div><small>REST TIMER</small><strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></div><button onClick={restAdd} aria-label="Add 30 seconds"><Plus size={18} /></button><button onClick={restStop} aria-label="Stop timer"><X size={18} /></button></div>}
    </main>}

    {view === 'history' && <main className="page standard-page"><div className="page-intro"><span className="section-index">02 / THE WORK</span><h1>Workout history<span className="accent-period">.</span></h1><p>Every session, saved exactly as you logged it.</p></div>{completed.length === 0 ? <div className="empty-state"><History size={30} /><h2>Your story starts here.</h2><p>Finish your first workout to see it in your history.</p><button onClick={() => navigate('home')}>Choose a workout <ArrowRight size={17} /></button></div> : <div className="history-list">{completed.map(session => { const prog = sessionProgress(session); return <button key={session.id} className="history-item" onClick={() => { setDetailId(session.id); navigate('detail') }}><div className="history-date"><strong>{dateLabel(session.startedAt, { day: '2-digit' })}</strong><span>{dateLabel(session.startedAt, { month: 'short' }).toUpperCase()}</span></div><div className="history-main"><strong>{session.routineName}</strong><span>{dateLabel(session.startedAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {prog.done} sets logged</span></div><ChevronRight size={20} /></button> })}</div>}</main>}

    {view === 'detail' && detail && <main className="page standard-page"><button className="back-link" onClick={() => navigate('history')}><ArrowLeft size={18} /> History</button><div className="page-intro"><span className="section-index">SESSION RECAP · {dateLabel(detail.startedAt).toUpperCase()}</span><h1>{detail.routineName}<span className="accent-period">.</span></h1><p>{timeLabel(detail.startedAt)} — {detail.endedAt ? timeLabel(detail.endedAt) : 'in progress'} · {sessionProgress(detail).done} sets logged</p></div><div className="detail-stack">{detail.exerciseSnapshots.map((snap, i) => <section className="detail-exercise" key={snap.id}><div className="detail-head"><span className="exercise-index">{String(i + 1).padStart(2, '0')}</span><div><h3>{snap.name}</h3><small>{snap.targetSets} × {snap.targetReps} TARGET</small></div></div>{detail.sets.filter(s => s.exerciseId === snap.id).map(set => <div className="detail-set" key={set.id}><span>SET {set.ordinal}</span><strong>{set.completedAt ? `${set.reps} reps · ${weightText(set.weight, snap.mode)}` : 'Not completed'}</strong>{set.dropReps !== null && <small>Drop: {set.dropReps} reps · {weightText(set.dropWeight, snap.mode)}</small>}</div>)}</section>)}</div></main>}

    {view === 'progress' && <main className="page standard-page"><div className="page-intro"><span className="section-index">03 / THE PROOF</span><h1>Progress<span className="accent-period">.</span></h1><p>See your work add up, one exercise at a time.</p></div><div className="progress-layout"><section className="panel"><label className="field-label" htmlFor="progress-exercise">EXERCISE</label><select id="progress-exercise" className="select-input" value={progressExercise?.id ?? ''} onChange={e => setProgressExerciseId(e.target.value)}>{data.routines.map(r => <optgroup label={r.name} key={r.id}>{r.exerciseIds.map(id => { const e = data.exercises.find(item => item.id === id); return e ? <option key={id} value={id}>{e.name}</option> : null })}</optgroup>)}</select><div className="progress-summary"><div><span>SESSIONS</span><strong>{chartSessions.length}</strong></div><div><span>{progressExercise?.mode === 'bodyweight' ? 'BEST REPS' : 'BEST LOAD'}</span><strong>{chartValues.length ? Math.max(...chartValues) : '—'}{chartValues.length && progressExercise?.mode !== 'bodyweight' && <small> kg</small>}</strong></div></div><MiniChart values={chartValues} labels={chartSessions.map(s => dateLabel(s.startedAt, { month: 'short', day: 'numeric' }))} unit={progressExercise?.mode === 'bodyweight' ? 'reps' : 'kg'} /></section><div className="progress-side"><div className="side-card"><Sparkles size={22} /><h3>Small wins count.</h3><p>Forge suggests the next load when you hit every planned set and rep. You always choose what feels right.</p></div>{progressExercise && <div className="next-card"><span>NEXT TARGET</span><strong>{weightText(getSuggestion(progressExercise, data.sessions).weight, progressExercise.mode)}</strong><small>{getSuggestion(progressExercise, data.sessions).ready ? progressExercise.mode === 'bodyweight' ? 'Ready to increase difficulty' : 'Target achieved · +2.5 kg suggested' : getSuggestion(progressExercise, data.sessions).hasHistory ? 'Repeat and build consistency' : 'Starting weight from Notes · editable'}</small></div>}</div></div></main>}

    {view === 'settings' && <main className="page standard-page"><div className="page-intro"><span className="section-index">04 / MAKE IT YOURS</span><h1>Settings<span className="accent-period">.</span></h1><p>Keep your training space exactly how you like it.</p></div><div className="settings-grid"><section className="panel"><div className="panel-title"><Clock3 size={21} /><div><h2>Rest timer</h2><p>Starts after you complete a set.</p></div></div><div className="timer-options">{[0, 60, 90, 120, 180].map(seconds => <button key={seconds} className={data.settings.restSeconds === seconds ? 'selected' : ''} onClick={() => update(d => { d.settings.restSeconds = seconds })}>{seconds ? `${Math.floor(seconds / 60)} min${seconds % 60 ? ' 30 sec' : ''}` : 'Off'}</button>)}</div></section><section className="panel"><div className="panel-title"><ShieldCheck size={21} /><div><h2>Your data, your phone</h2><p>Workouts are stored locally in this app.</p></div></div><p className="settings-copy">Browser storage can be cleared. Export a backup regularly and keep the file in iCloud Drive or another safe place.</p><div className="settings-actions"><button className="primary-button" onClick={exportBackup}><Download size={18} /> Export backup</button><button className="secondary-button" onClick={() => fileInput.current?.click()}><FileUp size={18} /> Import backup</button><input ref={fileInput} className="hidden-input" type="file" accept="application/json,.json" onChange={e => void importBackup(e.target.files?.[0])} /></div></section><section className="panel"><div className="panel-title"><SlidersHorizontal size={21} /><div><h2>Your routine</h2><p>Edit names, targets, weights, and order.</p></div></div><button className="secondary-button" onClick={() => navigate('editor')}>Edit your split <ArrowRight size={18} /></button></section><section className="panel install-panel"><div className="panel-title"><Activity size={21} /><div><h2>Add to Home Screen</h2><p>For quick access on your iPhone.</p></div></div><ol><li>Open your HTTPS app link in Safari.</li><li>Tap Share, then <strong>Add to Home Screen</strong>.</li><li>Open Forge from its new icon. It will work offline after the first load.</li></ol></section></div></main>}

    {view === 'editor' && <main className="page standard-page"><button className="back-link" onClick={() => navigate('home')}><ArrowLeft size={18} /> Home</button><div className="page-intro"><span className="section-index">YOUR SPLIT / FULL CONTROL</span><h1>Edit routine<span className="accent-period">.</span></h1><p>The Notes screenshots gave us a starting point. Make every detail yours.</p></div><div className="editor-layout"><aside className="routine-sidebar">{data.routines.map((r, i) => <button key={r.id} className={editingRoutine?.id === r.id ? 'active' : ''} onClick={() => setEditingRoutineId(r.id)}><span>0{i + 1}</span><strong>{r.name}</strong><ChevronRight size={16} /></button>)}<button className="add-routine" onClick={() => { const id = uid(); update(d => { d.routines.push({ id, name: 'New day', shortName: 'NEW DAY', exerciseIds: [] }) }); setEditingRoutineId(id) }}><Plus size={17} /> Add training day</button></aside>{editingRoutine && <div className="editor-main"><div className="editor-toolbar"><span>{editingRoutine.exerciseIds.length} EXERCISES</span><div><button onClick={() => update(d => { const i = d.routines.findIndex(r => r.id === editingRoutine.id); if (i > 0) [d.routines[i - 1], d.routines[i]] = [d.routines[i], d.routines[i - 1]] })} disabled={data.routines[0]?.id === editingRoutine.id} aria-label="Move day up"><ArrowUp size={17} /></button><button onClick={() => update(d => { const i = d.routines.findIndex(r => r.id === editingRoutine.id); if (i < d.routines.length - 1) [d.routines[i + 1], d.routines[i]] = [d.routines[i], d.routines[i + 1]] })} disabled={data.routines.at(-1)?.id === editingRoutine.id} aria-label="Move day down"><ArrowDown size={17} /></button><button className="delete-day" onClick={() => { if (!window.confirm(`Delete ${editingRoutine.name} from your routine? Past workout history will stay.`)) return; const id = editingRoutine.id; update(d => { d.routines = d.routines.filter(r => r.id !== id); d.exercises = d.exercises.filter(e => e.routineId !== id) }); setEditingRoutineId(data.routines.find(r => r.id !== id)?.id ?? '') }} aria-label="Delete day"><Trash2 size={17} /></button></div></div><div className="editor-day-fields"><label>DAY NAME<input value={editingRoutine.name} onChange={e => update(d => { d.routines.find(r => r.id === editingRoutine.id)!.name = e.target.value })} /></label><label>SHORT LABEL<input value={editingRoutine.shortName} onChange={e => update(d => { d.routines.find(r => r.id === editingRoutine.id)!.shortName = e.target.value })} /></label></div><div className="editor-exercises">{editingRoutine.exerciseIds.map((id, index) => { const ex = data.exercises.find(e => e.id === id); if (!ex) return null; return <div className="editor-exercise" key={id}><div className="editor-exercise-head"><span className="exercise-index">{String(index + 1).padStart(2, '0')}</span><strong>{ex.name || 'New exercise'}</strong><div><button onClick={() => update(d => { const list = d.routines.find(r => r.id === editingRoutine.id)!.exerciseIds; if (index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]] })} disabled={index === 0} aria-label={`Move ${ex.name} up`}><ArrowUp size={16} /></button><button onClick={() => update(d => { const list = d.routines.find(r => r.id === editingRoutine.id)!.exerciseIds; if (index < list.length - 1) [list[index + 1], list[index]] = [list[index], list[index + 1]] })} disabled={index === editingRoutine.exerciseIds.length - 1} aria-label={`Move ${ex.name} down`}><ArrowDown size={16} /></button><button onClick={() => { if (!window.confirm(`Remove ${ex.name} from this routine? Past workout history will stay.`)) return; update(d => { d.exercises = d.exercises.filter(e => e.id !== id); d.routines.find(r => r.id === editingRoutine.id)!.exerciseIds = d.routines.find(r => r.id === editingRoutine.id)!.exerciseIds.filter(x => x !== id) }) }} aria-label={`Remove ${ex.name}`}><Trash2 size={16} /></button></div></div><div className="exercise-fields"><label className="field-wide">EXERCISE NAME<input value={ex.name} onChange={e => update(d => { d.exercises.find(item => item.id === id)!.name = e.target.value })} /></label><label>SETS<input type="number" inputMode="numeric" min="1" max="20" value={ex.targetSets} onChange={e => update(d => { d.exercises.find(item => item.id === id)!.targetSets = Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label><label>REPS<input type="number" inputMode="numeric" min="1" max="100" value={ex.targetReps} onChange={e => update(d => { d.exercises.find(item => item.id === id)!.targetReps = Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></label><label>STARTING KG<input type="number" inputMode="decimal" step="0.5" min="0" disabled={ex.mode === 'bodyweight'} placeholder="—" value={ex.startingWeight ?? ''} onChange={e => update(d => { d.exercises.find(item => item.id === id)!.startingWeight = num(e.target.value) })} /></label><label>LOAD TYPE<select value={ex.mode} onChange={e => update(d => { const item = d.exercises.find(item => item.id === id)!; item.mode = e.target.value as LoadMode; if (item.mode === 'bodyweight') item.startingWeight = null })}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-wide">NOTES<input value={ex.note} placeholder="Optional cue or equipment detail" onChange={e => update(d => { d.exercises.find(item => item.id === id)!.note = e.target.value })} /></label></div></div> })}</div><button className="editor-add" onClick={() => { const id = uid(); update(d => { const ex: Exercise = { id, routineId: editingRoutine.id, name: 'New exercise', targetSets: 3, targetReps: 12, startingWeight: null, mode: 'kg', note: '' }; d.exercises.push(ex); d.routines.find(r => r.id === editingRoutine.id)!.exerciseIds.push(id) }) }}><Plus size={18} /> Add exercise</button></div>}</div></main>}

    {view !== 'session' && <nav className="bottom-nav" aria-label="Main navigation"><button className={view === 'home' || view === 'editor' ? 'active' : ''} onClick={() => navigate('home')}><Home size={21} /><span>Home</span></button><button className={view === 'history' || view === 'detail' ? 'active' : ''} onClick={() => navigate('history')}><History size={21} /><span>History</span></button><button className={view === 'progress' ? 'active' : ''} onClick={() => navigate('progress')}><BarChart3 size={21} /><span>Progress</span></button><button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={21} /><span>Settings</span></button></nav>}
    {message && <div className="toast" role="status">{message}</div>}
  </div>
}

export default App
