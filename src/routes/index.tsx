import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users, AlertTriangle, HeartPulse, UserCheck, Search, Filter,
  ChevronRight, Wifi, WifiOff, RefreshCw, Zap, PhoneCall,
  Activity, ArrowUpRight, TrendingUp, TrendingDown, Minus,
  LayoutGrid, List, AlertCircle
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RiskRing } from "@/components/RiskRing";
import { api, createDashboardWebSocket, type PatientSummary, type DashboardSummary } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Clinical Command Center · EaglesEye AI" }] }),
  component: Dashboard,
});

type SeverityFilter = "All" | "critical" | "high" | "moderate" | "low";
const FILTERS: SeverityFilter[] = ["All", "critical", "high", "moderate", "low"];

const SEVERITY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40" },
  high:     { label: "High Risk", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40" },
  moderate: { label: "Monitor",   bg: "bg-sky-500/15",   text: "text-sky-400",   border: "border-sky-500/40" },
  low:      { label: "Stable",    bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
};

function getTrendIcon(trend: string) {
  if (trend === "rapidly_deteriorating") return <span className="inline-flex items-center text-rose-400 font-semibold gap-0.5"><TrendingUp className="size-3.5" /> Rapid ↑</span>;
  if (trend === "deteriorating") return <span className="inline-flex items-center text-amber-400 font-semibold gap-0.5"><TrendingUp className="size-3.5" /> Deteriorating</span>;
  if (trend === "improving") return <span className="inline-flex items-center text-emerald-400 font-semibold gap-0.5"><TrendingDown className="size-3.5" /> Improving</span>;
  return <span className="inline-flex items-center text-slate-400 gap-0.5"><Minus className="size-3.5" /> Stable</span>;
}

function Dashboard() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [q, setQ] = useState("");
  const [selectedWard, setSelectedWard] = useState<string>("All");
  const [filter, setFilter] = useState<SeverityFilter>("All");
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [connected, setConnected] = useState(false);
  const [lastTick, setLastTick] = useState<string>("connecting...");
  const [loading, setLoading] = useState(true);

  // Load initial data
  const load = useCallback(async () => {
    try {
      const [pts, sum] = await Promise.all([
        api.getPatients(),
        api.getDashboardSummary().catch(() => null),
      ]);
      setPatients(pts);
      if (sum) setSummary(sum);
      setLastTick(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to load dashboard:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // WebSocket for live updates
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = createDashboardWebSocket((data: any) => {
        if (data?.type === "patient_update" || data?.total_patients !== undefined) {
          api.getPatients().then(setPatients).catch(() => {});
          api.getDashboardSummary().then(setSummary).catch(() => {});
          setLastTick(new Date().toLocaleTimeString());
        }
      });
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retryTimeout = setTimeout(connect, 4000);
      };
    };

    connect();
    const poll = setInterval(load, 8000);

    return () => {
      ws?.close();
      clearTimeout(retryTimeout);
      clearInterval(poll);
    };
  }, [load]);

  // Unique wards for filter
  const wards = useMemo(() => {
    const set = new Set(patients.map(p => p.ward));
    return ["All", ...Array.from(set)];
  }, [patients]);

  // Filtered patients
  const filtered = useMemo(() => {
    return patients.filter(p => {
      if (filter !== "All" && p.severity !== filter) return false;
      if (selectedWard !== "All" && p.ward !== selectedWard) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.ward.toLowerCase().includes(s) ||
        p.diagnosis.toLowerCase().includes(s)
      );
    });
  }, [patients, q, filter, selectedWard]);

  // Rank #1 Spotlight Patient (Highest urgency from backend)
  const rankOnePatient = useMemo(() => {
    if (!patients.length) return null;
    // Top of sorted patients
    return patients[0];
  }, [patients]);

  const criticalCount = summary?.critical_count ?? patients.filter(p => p.severity === "critical").length;
  const highRiskCount = summary?.high_risk_count ?? patients.filter(p => p.severity === "high").length;
  const activeAlerts = summary?.active_alerts ?? patients.reduce((acc, p) => acc + (p.active_alerts || 0), 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Top Operational Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.07]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest uppercase font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                Tier-1 Command Center
              </span>
              <span className="text-xs text-slate-400">· St. Aurora General Hospital</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Patient Triage & Response Intelligence
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs">
              {connected ? (
                <>
                  <span className="live-dot" />
                  <span className="text-emerald-400 font-medium">Telemetry Synchronized</span>
                </>
              ) : (
                <>
                  <WifiOff className="size-3 text-amber-400" />
                  <span className="text-amber-400 font-medium">Reconnecting Feed</span>
                </>
              )}
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 text-[11px] font-mono">{lastTick}</span>
            </div>

            <button
              onClick={load}
              className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-white/10 transition text-slate-300"
              title="Refresh Telemetry"
              aria-label="Refresh telemetry"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Priority KPI Grid with Clinical Urgency Hierarchy */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Critical Priority - Most Prominent */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between transition ${
            criticalCount > 0
              ? "bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/40"
              : "bg-slate-900/60 border-white/10"
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                {criticalCount > 0 && <span className="live-dot-critical" />} Critical Acuity
              </span>
              <HeartPulse className="size-4 text-rose-400" />
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {criticalCount}
              </div>
              <div className="text-[11px] text-rose-300/80 mt-0.5 font-medium">
                {criticalCount > 0 ? "Requires Immediate Bedside Action" : "No Critical Cases"}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5">
              Protocol: Rapid Response Ready
            </div>
          </div>

          {/* High Risk Drift */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-400 uppercase tracking-wider">High Risk Drift</span>
              <AlertTriangle className="size-4 text-amber-400" />
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {highRiskCount}
              </div>
              <div className="text-[11px] text-amber-300/80 mt-0.5 font-medium">
                Trending to Critical
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5">
              30-min vital check interval
            </div>
          </div>

          {/* Active Correlated Alerts */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-cyan-400 uppercase tracking-wider">Active Alarms</span>
              <Zap className="size-4 text-cyan-400" />
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {activeAlerts}
              </div>
              <div className="text-[11px] text-cyan-300/80 mt-0.5 font-medium">
                Correlated &amp; De-duplicated
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5">
              <Link to="/alerts" className="text-cyan-400 hover:underline">Review in Alert Center &rarr;</Link>
            </div>
          </div>

          {/* Available Nurses */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 uppercase tracking-wider">Clinical Staff</span>
              <UserCheck className="size-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {summary?.nurses_available ?? 5}
              </div>
              <div className="text-[11px] text-emerald-300/80 mt-0.5 font-medium">
                Nurses On Active Shift
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5">
              Coverage: All Wards Staffed
            </div>
          </div>

          {/* Total Census */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 uppercase tracking-wider">Total Monitored</span>
              <Users className="size-4 text-slate-400" />
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {patients.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Avg Acuity: {summary?.avg_risk ? Math.round(summary.avg_risk) : 20}%
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5">
              Live Sensor Ingestion Active
            </div>
          </div>
        </div>

        {/* RANK #1 PRIORITY PATIENT SPOTLIGHT CARD */}
        {rankOnePatient && rankOnePatient.risk_score >= 40 && (
          <div className="rounded-2xl p-5 border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-slate-900/90 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-cyan-500" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <RiskRing score={rankOnePatient.risk_score} size={64} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-sm">
                      PRIORITY ATTENTION · RANK #1
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${SEVERITY_BADGES[rankOnePatient.severity]?.bg} ${SEVERITY_BADGES[rankOnePatient.severity]?.text} ${SEVERITY_BADGES[rankOnePatient.severity]?.border}`}>
                      {rankOnePatient.severity}
                    </span>
                    {getTrendIcon(rankOnePatient.trend)}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    {rankOnePatient.name}
                    <span className="text-xs font-normal text-slate-400">
                      {rankOnePatient.id} · {rankOnePatient.age}{rankOnePatient.gender} · {rankOnePatient.ward} (Room {rankOnePatient.room})
                    </span>
                  </h2>

                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    <span className="font-semibold text-rose-300">Diagnosis: {rankOnePatient.diagnosis}. </span>
                    {rankOnePatient.reasoning || "Active deterioration detected across multi-parameter vital stream."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <Link
                  to="/patients/$id"
                  params={{ id: rankOnePatient.id }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold text-xs hover:shadow-lg hover:shadow-cyan-500/25 transition inline-flex items-center gap-1.5"
                >
                  Open Clinical Workspace <ArrowUpRight className="size-4" />
                </Link>
                <Link
                  to="/alerts"
                  className="px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <PhoneCall className="size-3.5" /> Dispatch Rapid Response
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Telemetry & Patient Census Panel */}
        <div className="clinical-panel rounded-2xl p-4 sm:p-5 space-y-4">
          {/* Controls: Search, Ward Dropdown, Severity Filter, View Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {/* Fuzzy Search */}
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search patient name, ID, ward, diagnosis..."
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Ward Dropdown */}
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>Ward:</span>
                <select
                  value={selectedWard}
                  onChange={e => setSelectedWard(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {wards.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Severity Filter Pills & View Mode */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto">
                {FILTERS.map(s => {
                  const active = filter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                        active
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                          : "text-slate-400 hover:text-white bg-slate-950/50 border border-white/5"
                      }`}
                    >
                      {s === "All" ? "All Patients" : s}
                    </button>
                  );
                })}
              </div>

              <div className="h-5 w-px bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded ${viewMode === "table" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  title="Table View"
                >
                  <List className="size-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`p-1.5 rounded ${viewMode === "board" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  title="Stage Board View"
                >
                  <LayoutGrid className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Patient Views */}
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-cyan-400" />
              Synchronizing clinical telemetry data...
            </div>
          ) : viewMode === "table" ? (
            /* Dense Clinical Table View */
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs min-w-[940px]">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-slate-400 border-b border-white/[0.08] text-[11px]">
                    <th className="py-2.5 px-3">Acuity</th>
                    <th className="py-2.5 px-3">Patient Identity</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Risk Assessment</th>
                    <th className="py-2.5 px-3">Trend</th>
                    <th className="py-2.5 px-3">Assigned Staff</th>
                    <th className="py-2.5 px-3">Alarms</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(p => {
                    const badge = SEVERITY_BADGES[p.severity] || SEVERITY_BADGES.low;
                    const isCritical = p.severity === "critical";

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-white/[0.02] transition ${
                          isCritical ? "bg-rose-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <RiskRing score={p.risk_score} size={42} />
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-white text-sm">
                            <Link to="/patients/$id" params={{ id: p.id }} className="hover:text-cyan-300">
                              {p.name}
                            </Link>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.id} · {p.age}{p.gender} · <span className="text-slate-300">{p.diagnosis}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-200">{p.ward}</div>
                          <div className="text-[10px] text-slate-500">Room {p.room} · Day {p.admitted_days}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label} ({Math.round(p.risk_score)}%)
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={p.reasoning}>
                            {p.reasoning || "Baseline normal"}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {getTrendIcon(p.trend)}
                        </td>

                        <td className="py-3 px-3">
                          {p.assigned_nurse ? (
                            <span className="text-slate-200 flex items-center gap-1 font-medium">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              {p.assigned_nurse}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {p.active_alerts > 0 ? (
                            <Link
                              to="/alerts"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/40 rounded-full px-2 py-0.5 hover:bg-rose-500/25 transition"
                            >
                              <AlertTriangle className="size-3" /> {p.active_alerts} Active
                            </Link>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Link
                            to="/patients/$id"
                            params={{ id: p.id }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition"
                          >
                            Open <ChevronRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No patients match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Acuity Stage Board View (Kanban style by Severity) */
            <div className="grid md:grid-cols-4 gap-4 pt-2">
              {(["critical", "high", "moderate", "low"] as const).map(sev => {
                const colPatients = filtered.filter(p => p.severity === sev);
                const badge = SEVERITY_BADGES[sev];

                return (
                  <div key={sev} className="rounded-xl bg-slate-950/60 border border-white/[0.06] p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                      <span className={`text-xs font-bold uppercase ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-bold">
                        {colPatients.length}
                      </span>
                    </div>

                    <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
                      {colPatients.map(p => (
                        <Link
                          key={p.id}
                          to="/patients/$id"
                          params={{ id: p.id }}
                          className="block p-3 rounded-lg bg-slate-900/90 border border-white/5 hover:border-cyan-400/40 transition group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-white text-xs group-hover:text-cyan-300">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {p.id} · {p.ward} Rm {p.room}
                              </div>
                            </div>
                            <span className="text-xs font-black font-mono text-white tabular-nums">
                              {Math.round(p.risk_score)}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-2 truncate">
                            {p.diagnosis}
                          </div>
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                            {getTrendIcon(p.trend)}
                            {p.active_alerts > 0 && (
                              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="size-2.5" /> {p.active_alerts}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                      {colPatients.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-600">
                          Empty
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Degraded Mode Global Notice (if active) */}
        {patients.some(p => p.ai_degraded) && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-400" />
            <div>
              <div className="font-bold text-sm">AI Degraded Mode Active</div>
              <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                One or more patient risk evaluations are operating under the deterministic clinical threshold fallback engine.
                The platform maintains 100% monitoring integrity; LLM-assisted summaries will resume automatically once external models recover.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
