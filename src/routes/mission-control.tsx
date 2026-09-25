import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Radar, AlertOctagon, UserPlus, Activity, Layers, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePatients, store } from "@/lib/store";
import { RiskRing } from "@/components/RiskRing";
import { STATUS_COLORS, STATUS_DOT } from "@/lib/mockData";

export const Route = createFileRoute("/mission-control")({
  head: () => ({ meta: [{ title: "Mission Control · EaglesEye AI" }] }),
  component: MissionControl,
});

function MissionControl() {
  const patients = usePatients();
  const top = patients.slice(0, 5);
  const alerts = patients.filter(p => p.alert);

  const wards = useMemo(() => {
    const map = new Map<string, { count: number; critical: number; avgRisk: number; sum: number }>();
    patients.forEach(p => {
      const w = map.get(p.ward) ?? { count: 0, critical: 0, avgRisk: 0, sum: 0 };
      w.count++; w.sum += p.riskScore;
      if (p.status === "Critical") w.critical++;
      w.avgRisk = Math.round(w.sum / w.count);
      map.set(p.ward, w);
    });
    return [...map.entries()].sort((a,b) => b[1].avgRisk - a[1].avgRisk);
  }, [patients]);

  const assignedNurses = patients.filter(p => p.assignedNurse).length;
  const workload = Math.min(100, Math.round((assignedNurses / store.totalNurses) * 100));

  const actions: Record<string, string> = {
    Critical: "Immediate bedside assessment",
    "High Risk": "Assign nurse · close monitoring",
    Monitor: "Continue 30-min vital checks",
    Stable: "Routine round",
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-900"><Radar className="size-5" /></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mission Control</h1>
            <p className="text-sm text-slate-400">AI-prioritized actions across the hospital</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Top recommendations */}
          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Top AI Recommendations</h3>
              <span className="text-xs text-slate-400">Re-ranked live</span>
            </div>
            <div className="flex flex-col gap-3">
              {top.map((p, i) => (
                <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl p-3 sm:p-4 bg-white/[0.03] border border-white/10 hover:border-cyan-400/30 transition">
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-lg grid place-items-center text-xs font-bold ${i === 0 ? "bg-rose-500/20 text-rose-200 border border-rose-400/40 pulse-critical" : i === 1 ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" : "bg-sky-500/15 text-sky-200 border border-sky-400/30"}`}>
                      P{i + 1}
                    </div>
                    <RiskRing score={p.riskScore} size={44} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.id} · {p.ward}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                    </div>
                    <div className="text-sm text-cyan-200 mt-1">→ {actions[p.status]}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{p.reasons[0]}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => store.assignNurse(p.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-900 text-xs font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition">
                      <UserPlus className="size-3.5" /> Assign
                    </button>
                    <Link to="/patients/$id" params={{ id: p.id }} className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10">
                      Open <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workload */}
          <div className="flex flex-col gap-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><Activity className="size-4 text-cyan-300" /><h3 className="font-semibold">Hospital Workload</h3></div>
              <div className="text-4xl font-bold tabular-nums">{workload}%</div>
              <div className="text-xs text-slate-400">{assignedNurses} of {store.totalNurses} nurses engaged</div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all" style={{ width: `${workload}%` }} />
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><AlertOctagon className="size-4 text-rose-300" /><h3 className="font-semibold">Active Alerts</h3></div>
              {alerts.length === 0 && <div className="text-sm text-slate-400">No active alerts — all clear.</div>}
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {alerts.map(a => (
                  <Link key={a.id} to="/patients/$id" params={{ id: a.id }} className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 hover:bg-rose-500/15 transition">
                    <span className={`size-2 rounded-full ${STATUS_DOT[a.status]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] text-rose-200/80 truncate">{a.reasons[0]}</div>
                    </div>
                    <span className="text-xs tabular-nums text-rose-200">{a.riskScore}%</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ward status */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Layers className="size-4 text-cyan-300" /><h3 className="font-semibold">Ward Status</h3></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {wards.map(([name, w]) => {
              const tone = w.avgRisk >= 70 ? "border-rose-400/40 from-rose-500/15" :
                           w.avgRisk >= 50 ? "border-amber-400/40 from-amber-500/15" :
                           "border-sky-400/30 from-sky-500/10";
              return (
                <div key={name} className={`rounded-xl border bg-gradient-to-br ${tone} to-transparent p-4`}>
                  <div className="text-sm font-semibold">{name}</div>
                  <div className="text-2xl font-bold tabular-nums mt-1">{w.avgRisk}<span className="text-xs text-slate-400 font-normal"> avg risk</span></div>
                  <div className="text-xs text-slate-400 mt-1">{w.count} patients · {w.critical} critical</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
