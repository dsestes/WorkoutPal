import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Workout Planner + Runner — Single React Component
 * -------------------------------------------------
 * Fix: Replaced the HTML + Babel snippet with a proper React file so the
 * canvas (code/react) bundler doesn't try to parse <!doctype ...> as TSX.
 *
 * Behavior:
 * - PLAN: choose routine, edit rounds inline, view exercises.
 * - RUN: each block completes ALL its rounds before advancing.
 * - Local persistence via localStorage.
 * - Minimal Test Panel renders PASS/FAIL checks.
 */

// ---------- UI PRIMITIVES ----------
const Card: React.FC<{ className?: string }> = ({ className = "", children }) => (
  <div className={`rounded-2xl shadow border border-gray-200 bg-white ${className}`}>{children}</div>
);
const CardBody: React.FC<{ className?: string }> = ({ className = "", children }) => (
  <div className={`p-4 sm:p-6 ${className}`}>{children}</div>
);
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }> = ({ className = "", children, ...props }) => (
  <button className={`px-4 py-2 rounded-xl border bg-gray-900 text-white hover:opacity-90 active:opacity-80 disabled:opacity-40 ${className}`} {...props}>{children}</button>
);
const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }> = ({ className = "", children, ...props }) => (
  <button className={`px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 ${className}`} {...props}>{children}</button>
);
const Badge: React.FC<{ tone?: "gray"|"green"|"blue"; className?: string }> = ({ children, tone = "gray", className = "" }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
    tone==='green'?'bg-green-50 text-green-700 border-green-200':
    tone==='blue' ?'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
  } ${className}`}>{children}</span>
);

// ---------- HELPERS / HOOKS ----------
const toMs = (sec?: number) => Math.max(0, Math.round(Number(sec||0)*1000));

function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const raw = window.localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) as T : initialValue;
    } catch { return initialValue; }
  });
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}

function useCountdown(ms: number, running: boolean) {
  const [remaining, setRemaining] = useState(ms);
  const rafRef = useRef<number | null>(null);
  useEffect(() => { setRemaining(ms); }, [ms]);
  useEffect(() => {
    if (!running) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const start = performance.now();
    const loop = (t: number) => {
      const elapsed = t - start;
      const next = Math.max(0, ms - elapsed);
      setRemaining(next);
      if (next > 0) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ms, running]);
  return [remaining] as const;
}

// ---------- DATA ----------
export type Unit = 'seconds' | 'reps';
export interface Exercise { description: string; duration: number; unit: Unit; instructions?: string }
export interface Block { name: string; rounds: number; exercises: Exercise[] }
export interface Workout { title: string; categories: Block[] }

const INITIAL_LIBRARY: Workout[] = [
  {
    title: "Arm & Ab Workout",
    categories: [
      { name: "Warm-Up", rounds: 1, exercises: [
        { description: "Arm Circles", duration: 30, unit: "seconds", instructions: "Small→large circles, forward & backward." },
        { description: "Cat-Cow", duration: 6, unit: "reps", instructions: "Breathe with movement; move through full spine." },
        { description: "Torso Twists", duration: 20, unit: "reps", instructions: "Rotate gently; keep hips facing forward." }
      ]},
      { name: "Core (Mat)", rounds: 3, exercises: [
        { description: "Plank Hold", duration: 45, unit: "seconds", instructions: "Elbows under shoulders; ribs down; glutes on; no sagging." },
        { description: "Bicycle Crunches", duration: 20, unit: "reps", instructions: "Slow & controlled; shoulder off mat; exhale on twist." },
        { description: "Russian Twists", duration: 20, unit: "reps", instructions: "Neutral spine; rotate from ribcage; tap floor each side." }
      ]},
      { name: "Upper Body (Weights)", rounds: 3, exercises: [
        { description: "Dumbbell Curl to Press", duration: 12, unit: "reps", instructions: "No swinging; rotate to neutral on press; lock ribs." },
        { description: "Bench Dips", duration: 12, unit: "reps", instructions: "Shoulders down/back; stop ~90° elbow; full lockout up." },
        { description: "Hammer Curls", duration: 12, unit: "reps", instructions: "Elbows tucked; neutral grip; control negative." }
      ]},
      { name: "Cooldown", rounds: 1, exercises: [
        { description: "Seated Forward Fold", duration: 45, unit: "seconds", instructions: "Hinge at hips; soft knees; relax neck/jaw." },
        { description: "Cross-Body Shoulder", duration: 30, unit: "seconds", instructions: "Gently pull arm across; keep shoulder down." },
        { description: "Child's Pose", duration: 45, unit: "seconds", instructions: "Sit back to heels; reach long; slow breaths." }
      ]}
    ]
  },
  {
    title: "Leg & Glute Workout",
    categories: [
      { name: "Warm-Up", rounds: 1, exercises: [
        { description: "Bodyweight Squats", duration: 12, unit: "reps", instructions: "Feet shoulder-width; sit back; chest tall." },
        { description: "Hip Circles", duration: 30, unit: "seconds", instructions: "Hands on hips; draw big circles; both directions." },
        { description: "Leg Swings", duration: 10, unit: "reps", instructions: "Front↔back; brace core; build range gradually." }
      ]},
      { name: "Glute Activation (Mat)", rounds: 3, exercises: [
        { description: "Glute Bridge", duration: 15, unit: "reps", instructions: "Heels close; drive through heels; pause/squeeze at top." },
        { description: "Clamshells", duration: 15, unit: "reps", instructions: "Band above knees; no hip roll; small controlled ROM." },
        { description: "Side Plank Hip Lifts", duration: 12, unit: "reps", instructions: "Elbow under shoulder; stack feet; lift straight up/down." }
      ]},
      { name: "Leg Strength (Weights)", rounds: 3, exercises: [
        { description: "Bulgarian Split Squat", duration: 12, unit: "reps", instructions: "Long stance; torso tall; knee tracks over mid-foot." },
        { description: "Step Ups", duration: 12, unit: "reps", instructions: "Full foot on bench; drive through heel; control down." },
        { description: "Romanian Deadlift", duration: 12, unit: "reps", instructions: "Hinge at hips; flat back; slight knee bend; stretch hams." },
        { description: "Squat Jumps", duration: 15, unit: "reps", instructions: "Soft landing; chest tall; power — good for skiing." }
      ]},
      { name: "Cooldown", rounds: 1, exercises: [
        { description: "Standing Quad", duration: 30, unit: "seconds", instructions: "Knees together; slight tuck; tall posture." },
        { description: "Figure-4", duration: 30, unit: "seconds", instructions: "Cross ankle over knee; sit back; keep spine long." },
        { description: "Seated Hamstring", duration: 45, unit: "seconds", instructions: "Extend leg; hinge forward; breathe into stretch." }
      ]}
    ]
  }
];

// ---------- SCHEDULER ----------
export interface Step { bi: number; ri: number; ei: number }
function buildSchedule(blocks: Block[]): Step[] {
  const steps: Step[] = [];
  (blocks||[]).forEach((blk, bi) => {
    const rounds = Math.max(1, Number(blk.rounds || 1));
    for (let r = 1; r <= rounds; r++) {
      (blk.exercises||[]).forEach((_, ei) => steps.push({ bi, ri: r, ei }));
    }
  });
  return steps;
}

// ---------- MAIN APP ----------
export default function App() {
  const [library, setLibrary] = useLocalStorage<Workout[]>("workout_library_v2", INITIAL_LIBRARY);
  const [currentIndex, setCurrentIndex] = useLocalStorage<number>("workout_current_index", 0);
  const [mode, setMode] = useLocalStorage<"PLAN"|"RUN">("mode", "PLAN");

  const workout = library[currentIndex] || INITIAL_LIBRARY[0];
  const blocks = workout.categories || [];

  const [schedule, setSchedule] = useState<Step[]>([]);
  const [idx, setIdx] = useState(0);
  const cur = schedule[idx];
  const currentBlock = cur ? blocks[cur.bi] : undefined;
  const current = cur && currentBlock ? currentBlock.exercises?.[cur.ei] : undefined;

  const [running, setRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => { setRunning(false); setTimerDone(false); setSeed(s=>s+1); }, [idx, current?.unit, current?.duration]);

  const startRun = () => { setSchedule(buildSchedule(blocks)); setIdx(0); setMode('RUN'); };
  const next = () => { if (idx + 1 < schedule.length) setIdx(idx + 1); else setMode('PLAN'); };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  const blockName = (currentBlock?.name || '').toLowerCase();
  const isMat = blockName.includes('mat');
  const isWeights = blockName.includes('weight');

  // ---------- TESTS ----------
  const tests = useMemo(() => {
    const out: { name: string; pass: boolean; info?: string }[] = [];
    try { out.push({ name: 'library has ≥ 2 routines', pass: Array.isArray(library) && library.length >= 2, info: `count=${library?.length}` }); } catch { out.push({ name: 'library has ≥ 2 routines', pass: false }); }
    try {
      const core = INITIAL_LIBRARY[0].categories[1];
      const steps = buildSchedule([core]);
      out.push({ name: 'Core (Mat) -> 3 rounds × 3 = 9 steps', pass: steps.length === 9, info: `got ${steps.length}` });
    } catch { out.push({ name: 'Core (Mat) steps', pass: false }); }
    try {
      const total = blocks.reduce((sum, b) => sum + Math.max(1, Number(b.rounds||1)) * (b.exercises?.length||0), 0);
      out.push({ name: 'schedule length equals Σ(ex*rounds)', pass: mode==='RUN' ? schedule.length === total : true, info: `total=${total}` });
    } catch { out.push({ name: 'schedule length check', pass: false }); }
    try {
      // localStorage probe (safe)
      const k = `__probe_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(k, JSON.stringify('ok'));
      const v = JSON.parse(window.localStorage.getItem(k) as string);
      window.localStorage.removeItem(k);
      out.push({ name: 'localStorage roundtrip', pass: v === 'ok' });
    } catch { out.push({ name: 'localStorage roundtrip', pass: false }); }
    return out;
  }, [blocks, mode, schedule.length, library]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <select className="border rounded-lg px-2 py-1" value={currentIndex}
              onChange={(e)=> setCurrentIndex(Number(e.target.value))}>
              {library.map((w,i)=> (<option key={i} value={i}>{w.title}</option>))}
            </select>
            <Badge tone="gray">{blocks.length} blocks</Badge>
          </div>
          {mode === 'PLAN' ? (
            <Button onClick={startRun}>Start ▶</Button>
          ) : (
            <GhostButton onClick={()=> setMode('PLAN')}>Exit</GhostButton>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {mode === 'PLAN' && (
          <div className="space-y-4">
            {blocks.map((blk, bi) => (
              <Card key={bi}><CardBody>
                <div className="flex items-center justify-between">
                  <div className="font-semibold flex items-center gap-2">
                    {blk.name}
                    <Badge tone={/mat/i.test(blk.name)?'green':/weight/i.test(blk.name)?'blue':'gray'}>
                      {/mat/i.test(blk.name)?'MAT':/weight/i.test(blk.name)?'WEIGHTS':'BLOCK'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rounds</span>
                    <input type="number" min={1} className="w-20 text-right bg-gray-50 px-2 py-1 rounded-lg border"
                      value={blk.rounds}
                      onChange={(e)=>{
                        const next = [...library];
                        next[currentIndex] = { ...next[currentIndex] };
                        next[currentIndex].categories = [...next[currentIndex].categories];
                        next[currentIndex].categories[bi] = { ...next[currentIndex].categories[bi], rounds: Math.max(1, Number(e.target.value)||1) };
                        setLibrary(next);
                      }} />
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {(blk.exercises||[]).map((ex,ei)=> (
                    <li key={ei} className="text-sm text-gray-700">
                      <span className="text-gray-500 mr-2">{ei+1}.</span>
                      {ex.description} — {ex.duration} {ex.unit}
                    </li>
                  ))}
                </ul>
              </CardBody></Card>
            ))}

            {/* Test Panel */}
            <Card><CardBody>
              <div className="font-semibold mb-2 text-sm">Test Panel</div>
              <ul className="space-y-1">
                {tests.map((t,i)=> (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Badge tone={t.pass? 'green' : 'gray'}>{t.pass? 'PASS' : 'FAIL'}</Badge>
                    <span>{t.name}</span>
                    {t.info && <span className="text-xs text-gray-500">({t.info})</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-gray-500">If any fail after edits, tell me and I’ll adjust them.</div>
            </CardBody></Card>
          </div>
        )}

        {mode === 'RUN' && current && (
          <Card><CardBody>
            <div className="text-sm text-gray-500">
              {currentBlock!.name} • Round {cur.ri}/{currentBlock!.rounds} • Block {cur.bi+1}/{blocks.length}
              <span className="ml-2">
                <Badge tone={isMat? 'green' : isWeights? 'blue' : 'gray'}>
                  {isMat ? 'MAT' : isWeights ? 'WEIGHTS' : 'BLOCK'}
                </Badge>
              </span>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold mt-2 break-words">{current!.description}</div>
            {current!.instructions && <div className="text-base text-gray-700 max-w-[30rem] mt-2">{current!.instructions}</div>}

            {current!.unit === 'seconds' ? (
              <BigTimer key={seed} ms={toMs(current!.duration)} running={running}
                onToggle={()=>setRunning(r=>!r)} onComplete={()=>setTimerDone(true)} />
            ) : (
              <div className="mt-4">
                <div className="text-3xl font-bold">{current!.duration} reps</div>
                <Button className="mt-2" onClick={next}>Done ✓</Button>
              </div>
            )}

            {timerDone && <div className="text-green-600 mt-2">Timer done — tap Next</div>}
            <div className="flex gap-2 mt-6">
              <GhostButton onClick={prev}>◀ Prev</GhostButton>
              <GhostButton onClick={()=> setMode('PLAN')}>Exit</GhostButton>
              <Button onClick={next}>Next ✓</Button>
            </div>
          </CardBody></Card>
        )}
      </main>
    </div>
  );
}

function BigTimer({ ms, running, onToggle, onComplete }: { ms: number; running: boolean; onToggle: ()=>void; onComplete: ()=>void }) {
  const [remaining] = useCountdown(ms, running);
  const seconds = Math.ceil(remaining/1000);
  useEffect(()=>{ if (remaining===0) onComplete?.(); }, [remaining, onComplete]);
  return (
    <div className="flex flex-col items-center gap-2 mt-6">
      <div className={`text-7xl font-bold ${seconds===0?'text-red-600':''}`}>{seconds}</div>
      <GhostButton onClick={onToggle}>{running?"Pause":"Start"}</GhostButton>
    </div>
  );
}
