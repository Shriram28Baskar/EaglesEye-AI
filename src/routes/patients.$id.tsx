import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Activity, Droplet, Thermometer, Wind, Sparkles, UserPlus, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RiskRing } from "@/components/RiskRing";
import { usePatients, store } from "@/lib/store";
import { STATUS_COLORS } from "@/lib/mockData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";

export const Route = createFileRoute("/patients/$id")({
  head: () => ({ meta: [{ title: "Patient · EaglesEye AI" }] }),
  component: PatientDetails,
});

function Vital({ icon, label, value, unit, warn }: { icon: React.ReactNode; label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className={`glass rounded-xl p-4 ${warn ? "ring-1 ring-rose-400/40" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${warn ? "text-rose-300" : "text-white"}`}>{value}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span></div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
};

function PatientDetails() {
  const { id } = Route.useParams();
  const patients = usePatients();
  const navigate = useNavigate();
  const p = patients.find(x => x.id === id);

  if (!p) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-10 text-center">
          <h2 className="text-xl font-semibold">Patient not found</h2>
          <Link to="/" className="inline-flex items-center gap-2 mt-4 text-cyan-300"><ArrowLeft className="size-4" /> Back to dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const predData = [{ t: "now", risk: p.riskScore }, ...p.predictions.map(x => ({ t: `+${x.t}m`, risk: x.risk }))];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <button onClick={() => navigate({ to: "/" })} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-2">
              <ArrowLeft className="size-3.5" /> Dashboard
            </button>
            <div className="flex items-center gap-4 flex-wrap">
              <RiskRing score={p.riskScore} size={64} />
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{p.name}</h1>
                <div className="text-sm text-slate-400 mt-0.5">
                  {p.id} · {p.age}{p.gender} · {p.ward} · Room {p.room}
                </div>
                <div className="text-xs text-slate-400 mt-1">Diagnosis: <span className="text-slate-200">{p.diagnosis}</span> · Day {p.admittedDays}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs border ${STATUS_COLORS[p.status]}`}>{p.status}</span>
            </div>
          </div>
          <button
            onClick={() => store.assignNurse(p.id)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-900 font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition"
          >
            <UserPlus className="size-4" /> Assign Nurse
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Vital icon={<Wind className="size-4" />} label="SpO₂" value={p.spo2} unit="%" warn={p.spo2 < 92} />
          <Vital icon={<Activity className="size-4" />} label="Heart Rate" value={p.heartRate} unit="bpm" warn={p.heartRate > 110 || p.heartRate < 55} />
          <Vital icon={<Droplet className="size-4" />} label="Blood Pressure" value={`${p.bpSys}/${p.bpDia}`} unit="mmHg" warn={p.bpSys < 95 || p.bpSys > 160} />
          <Vital icon={<Thermometer className="size-4" />} label="Temperature" value={p.temperature.toFixed(1)} unit="°C" warn={p.temperature > 38.5} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-cyan-300" />
              <h3 className="font-semibold">AI Analysis</h3>
              <span className="ml-auto text-xs text-slate-400">Confidence 92%</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl font-bold tabular-nums text-white">{p.riskScore}<span className="text-base text-slate-400 font-normal">% risk</span></div>
              <span className={`px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[p.status]}`}>{p.status}</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-slate-400">Why this score?</div>
              {p.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-200 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5">
                  <span className="mt-1 size-1.5 rounded-full bg-cyan-300 shrink-0" />{r}
                </div>
              ))}
            </div>
            {p.assignedNurse && (
              <div className="mt-4 text-xs text-emerald-300 flex items-center gap-2">
                <UserPlus className="size-3.5" /> Nurse {p.assignedNurse} assigned · response in progress
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-amber-300" />
              <h3 className="font-semibold">Risk Forecast</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {p.predictions.map(pr => {
                const delta = pr.risk - p.riskScore;
                const tone = pr.risk >= 80 ? "text-rose-300" : pr.risk >= 60 ? "text-amber-300" : "text-emerald-300";
                return (
                  <div key={pr.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">+{pr.t} min</div>
                    <div className={`text-xl font-bold tabular-nums ${tone}`}>{pr.risk}%</div>
                    <div className="text-[11px] text-slate-400">{delta >= 0 ? "+" : ""}{delta} pts</div>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 mt-3">Predictions based on vitals trajectory &amp; cohort patterns.</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="SpO₂ Trend (last 60 min)" color="oklch(0.75 0.17 220)" data={p.history} dataKey="spo2" domain={[80, 100]} unit="%" />
          <ChartCard title="Heart Rate Trend" color="oklch(0.75 0.2 30)" data={p.history} dataKey="hr" domain={[40, 160]} unit="bpm" />
          <RiskTrendCard data={[...p.history, ...p.predictions.map(pr => ({ t: `+${pr.t}m`, risk: pr.risk, spo2: 0, hr: 0 }))]} now={p.history.length - 1} />
        </div>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, color, data, dataKey, domain, unit }: any) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis domain={domain} tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}${unit}`, title]} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RiskTrendCard({ data }: { data: any[]; now: number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-2">Risk Trajectory (history → forecast)</h3>
      <div className="h-44">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="riskG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.75 0.2 30)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="oklch(0.75 0.2 30)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, "Risk"]} />
            <Area type="monotone" dataKey="risk" stroke="oklch(0.75 0.2 30)" strokeWidth={2.5} fill="url(#riskG)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
