export type Status = "Stable" | "Monitor" | "High Risk" | "Critical";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  ward: string;
  room: string;
  spo2: number;
  heartRate: number;
  bpSys: number;
  bpDia: number;
  temperature: number;
  riskScore: number;
  status: Status;
  admittedDays: number;
  diagnosis: string;
  assignedNurse: string | null;
  history: VitalsPoint[];
  predictions: { t: number; risk: number }[];
  reasons: string[];
  alert: boolean;
}

export interface VitalsPoint {
  t: string;
  spo2: number;
  hr: number;
  risk: number;
}

const FIRST = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Ayaan","Krishna","Ishaan","Ananya","Diya","Saanvi","Aadhya","Anika","Navya","Kiara","Myra","Sara","Riya","John","Emma","Liam","Olivia","Noah","Ava","Mia","Lucas"];
const LAST = ["Sharma","Verma","Patel","Iyer","Reddy","Kumar","Singh","Khan","Mehta","Joshi","Smith","Johnson","Brown","Davis","Wilson"];
const WARDS = ["ICU-A","ICU-B","CCU","General-1","General-2","Pediatrics","Cardiac","Pulmonary"];
const DIAGS = ["Post-op recovery","Pneumonia","Cardiac arrhythmia","Sepsis (suspected)","COPD exacerbation","Stroke recovery","Diabetic ketoacidosis","Acute renal failure","Myocardial infarction","Severe asthma"];
const NURSES = ["N. Patel","S. Khan","R. Mehta","A. Singh","L. Davis","M. Brown","K. Iyer","D. Joshi"];

// Deterministic PRNG so initial state is stable across SSR/CSR
let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + rand() * (b - a);

function statusFromRisk(r: number): Status {
  if (r >= 80) return "Critical";
  if (r >= 60) return "High Risk";
  if (r >= 35) return "Monitor";
  return "Stable";
}

function genReasons(p: Pick<Patient,"spo2"|"heartRate"|"bpSys"|"temperature">): string[] {
  const r: string[] = [];
  if (p.spo2 < 92) r.push(`SpO₂ at ${p.spo2}% — below safe threshold (94%)`);
  else if (p.spo2 < 95) r.push(`SpO₂ trending down (${p.spo2}%) over last 20 min`);
  if (p.heartRate > 110) r.push(`Heart rate elevated to ${p.heartRate} bpm (+18 from baseline)`);
  else if (p.heartRate < 55) r.push(`Bradycardia detected — HR ${p.heartRate} bpm`);
  if (p.bpSys < 95) r.push(`Systolic BP dropping (${p.bpSys} mmHg) — possible hypotension`);
  else if (p.bpSys > 160) r.push(`Hypertensive reading: ${p.bpSys} mmHg systolic`);
  if (p.temperature > 38.5) r.push(`Fever spike: ${p.temperature.toFixed(1)}°C`);
  else if (p.temperature < 35.5) r.push(`Hypothermia warning: ${p.temperature.toFixed(1)}°C`);
  if (r.length === 0) r.push("All vitals within stable range");
  return r;
}

function genHistory(currentSpo2: number, currentHr: number, currentRisk: number): VitalsPoint[] {
  const out: VitalsPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const drift = (i / 11) * 0.4;
    out.push({
      t: `-${i * 5}m`,
      spo2: Math.round(Math.max(80, Math.min(100, currentSpo2 + (rand() - 0.3) * 4 + drift * 2))),
      hr: Math.round(Math.max(45, Math.min(160, currentHr + (rand() - 0.5) * 12 - drift * 3))),
      risk: Math.round(Math.max(5, Math.min(99, currentRisk + (rand() - 0.5) * 10 - drift * 8))),
    });
  }
  out.push({ t: "now", spo2: currentSpo2, hr: currentHr, risk: currentRisk });
  return out;
}

function genPredictions(currentRisk: number) {
  const trend = (rand() - 0.4) * 6;
  return [15, 30, 45, 60].map((t, i) => ({
    t,
    risk: Math.round(Math.max(5, Math.min(99, currentRisk + trend * (i + 1) + (rand() - 0.5) * 4))),
  }));
}

function makePatient(i: number): Patient {
  // Distribute severity
  let risk: number;
  if (i < 3) risk = Math.round(between(82, 96));
  else if (i < 7) risk = Math.round(between(62, 79));
  else if (i < 13) risk = Math.round(between(38, 58));
  else risk = Math.round(between(8, 32));

  const critical = risk >= 80;
  const high = risk >= 60;

  const spo2 = critical ? Math.round(between(82, 91)) : high ? Math.round(between(91, 95)) : Math.round(between(95, 100));
  const hr = critical ? Math.round(between(115, 145)) : high ? Math.round(between(95, 115)) : Math.round(between(62, 90));
  const bpSys = critical ? Math.round(between(80, 100)) : Math.round(between(105, 140));
  const bpDia = Math.round(between(55, 90));
  const temperature = critical ? Number(between(38.4, 39.8).toFixed(1)) : Number(between(36.4, 37.6).toFixed(1));

  const base = {
    spo2, heartRate: hr, bpSys, temperature,
  };

  return {
    id: `P${String(i + 1).padStart(2, "0")}`,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    age: Math.floor(between(18, 86)),
    gender: rand() > 0.5 ? "M" : "F",
    ward: pick(WARDS),
    room: `${Math.floor(between(101, 420))}`,
    spo2,
    heartRate: hr,
    bpSys,
    bpDia,
    temperature,
    riskScore: risk,
    status: statusFromRisk(risk),
    admittedDays: Math.floor(between(1, 14)),
    diagnosis: pick(DIAGS),
    assignedNurse: rand() > 0.4 ? pick(NURSES) : null,
    history: genHistory(spo2, hr, risk),
    predictions: genPredictions(risk),
    reasons: genReasons(base),
    alert: critical || (high && rand() > 0.4),
  };
}

export function generatePatients(): Patient[] {
  seed = 42;
  const list = Array.from({ length: 20 }, (_, i) => makePatient(i));
  return list.sort((a, b) => b.riskScore - a.riskScore);
}

export const STATUS_COLORS: Record<Status, string> = {
  Critical: "text-rose-300 bg-rose-500/15 border-rose-500/40",
  "High Risk": "text-amber-300 bg-amber-500/15 border-amber-500/40",
  Monitor: "text-sky-300 bg-sky-500/15 border-sky-500/40",
  Stable: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40",
};

export const STATUS_DOT: Record<Status, string> = {
  Critical: "bg-rose-400",
  "High Risk": "bg-amber-400",
  Monitor: "bg-sky-400",
  Stable: "bg-emerald-400",
};
