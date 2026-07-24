import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, AlertTriangle, HeartPulse, UserCheck, Search, Filter, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { RiskRing } from "@/components/RiskRing";
import { AuditLogsPanel } from "@/components/AuditLogsPanel";
import { usePatients, store } from "@/lib/store";
import { STATUS_COLORS, STATUS_DOT, type Status } from "@/lib/mockData";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · EaglesEye AI" }] }),
  component: Dashboard,
});

const STATUSES: (Status | "All")[] = ["All", "Critical", "High Risk", "Monitor", "Stable"];

function Dashboard() {
  const patients = usePatients();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "All">("All");

  const filtered = useMemo(() => {
    return patients.filter(p => {
      if (filter !== "All" && p.status !== filter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) || p.ward.toLowerCase().includes(s);
    });
  }, [patients, q, filter]);

  const critical = patients.filter(p => p.status === "Critical").length;
  const alerts = patients.filter(p => p.alert).length;
  const available = store.totalNurses - patients.filter(p => p.assignedNurse).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Triage Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Patients auto-ranked by AI risk score · updates every few seconds</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Patients" value={patients.length} icon={<Users className="size-5" />} accent="cyan" sub="across 8 wards" />
          <StatCard label="Critical" value={critical} icon={<HeartPulse className="size-5" />} accent="rose" sub="requires action" />
          <StatCard label="Available Nurses" value={Math.max(0, available)} icon={<UserCheck className="size-5" />} accent="emerald" sub={`of ${store.totalNurses} on shift`} />
          <StatCard label="Active Alerts" value={alerts} icon={<AlertTriangle className="size-5" />} accent="amber" sub="open right now" />
        </div>

        <div className="glass rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center gap-3 mb-4">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search patient, ID, or ward…"
                className="w-full sm:w-80 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto shrink-0">
              <Filter className="size-4 text-slate-400 shrink-0" />
              {STATUSES.map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition",
                    filter === s
                      ? "bg-cyan-400/15 border-cyan-400/40 text-white"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10",
                  ].join(" ")}>{s}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="py-2.5 px-3">Risk</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Ward</th>
                  <th className="py-2.5 px-3">SpO₂</th>
                  <th className="py-2.5 px-3">HR</th>
                  <th className="py-2.5 px-3">BP</th>
                  <th className="py-2.5 px-3">Temp</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={[
                    "border-b border-white/5 hover:bg-white/[0.03] transition",
                    p.status === "Critical" ? "bg-rose-500/[0.04]" : "",
                  ].join(" ")}>
                    <td className="py-3 px-3"><RiskRing score={p.riskScore} size={44} /></td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.id} · {p.age}{p.gender} · {p.diagnosis}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{p.ward}<div className="text-xs text-slate-500">Room {p.room}</div></td>
                    <td className={`py-3 px-3 tabular-nums ${p.spo2 < 92 ? "text-rose-300 font-semibold" : p.spo2 < 95 ? "text-amber-300" : "text-slate-200"}`}>{p.spo2}%</td>
                    <td className={`py-3 px-3 tabular-nums ${p.heartRate > 110 || p.heartRate < 55 ? "text-amber-300" : "text-slate-200"}`}>{p.heartRate}</td>
                    <td className="py-3 px-3 tabular-nums text-slate-200">{p.bpSys}/{p.bpDia}</td>
                    <td className="py-3 px-3 tabular-nums text-slate-200">{p.temperature.toFixed(1)}°</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[p.status]}`}>
                        <span className={`size-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Link to="/patients/$id" params={{ id: p.id }} className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 text-xs">
                        Open <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-400">No patients match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <AuditLogsPanel />
      </div>
    </AppShell>
  );
}
