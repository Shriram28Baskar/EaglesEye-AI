import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { BarChart3, AlertTriangle, HeartPulse, TrendingUp, Users, RefreshCw, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { api, type PatientSummary } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Ward Analytics · EaglesEye AI" }] }),
  component: Analytics,
});

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f43f5e",
  high: "#f59e0b",
  moderate: "#38bdf8",
  low: "#10b981",
};

const tooltipStyle = {
  contentStyle: { background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
};

export function Analytics() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [pts, alerts] = await Promise.all([
        api.getPatients(),
        api.getAlerts().catch(() => []),
      ]);
      setPatients(pts);
      setAlertsCount(alerts.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dist = useMemo(() => {
    const buckets = [
      { key: "low", label: "Stable" },
      { key: "moderate", label: "Monitor" },
      { key: "high", label: "High Risk" },
      { key: "critical", label: "Critical" },
    ];
    return buckets.map(b => ({
      name: b.label,
      value: patients.filter(p => p.severity === b.key).length,
      fill: SEVERITY_COLORS[b.key],
    }));
  }, [patients]);

  const wards = useMemo(() => {
    const m = new Map<string, { ward: string; avgRisk: number; critical: number; count: number; sum: number }>();
    patients.forEach(p => {
      const w = m.get(p.ward) ?? { ward: p.ward, avgRisk: 0, critical: 0, count: 0, sum: 0 };
      w.count++;
      w.sum += p.risk_score;
      if (p.severity === "critical") w.critical++;
      w.avgRisk = Math.round(w.sum / w.count);
      m.set(p.ward, w);
    });
    return [...m.values()].sort((a, b) => b.avgRisk - a.avgRisk);
  }, [patients]);

  const critical = patients.filter(p => p.severity === "critical").length;
  const highRisk = patients.filter(p => p.severity === "high").length;
  const avgRisk = patients.length
    ? Math.round(patients.reduce((s, p) => s + p.risk_score, 0) / patients.length)
    : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ward-Level Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">
              Cross-ward clinical load, acuity distributions, and alert incidence.
            </p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl glass hover:bg-white/10 transition text-slate-300"
            title="Refresh Analytics"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Monitored" value={patients.length} icon={<Users className="size-5" />} accent="cyan" sub="across all active wards" />
          <StatCard label="Critical Acuity" value={critical} icon={<HeartPulse className="size-5" />} accent="rose" sub="immediate clinical review" />
          <StatCard label="High Risk Drift" value={highRisk} icon={<TrendingUp className="size-5" />} accent="amber" sub="trending toward critical" />
          <StatCard label="Total Alerts" value={alertsCount} icon={<AlertTriangle className="size-5" />} accent="emerald" sub="active in system" />
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Ward Risk Breakdown */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-cyan-400" /> Average Patient Risk by Ward
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wards} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="ward" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, "Avg Risk"]} />
                  <Bar dataKey="avgRisk" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Acuity Distribution Pie */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <HeartPulse className="size-4 text-rose-400" /> Patient Acuity Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={4}
                  >
                    {dist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, fill: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Ward Census Table */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-base">Ward Census & Load Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="py-2.5 px-3">Ward</th>
                  <th className="py-2.5 px-3">Census</th>
                  <th className="py-2.5 px-3">Average Risk</th>
                  <th className="py-2.5 px-3">Critical Cases</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {wards.map(w => (
                  <tr key={w.ward} className="hover:bg-white/[0.02] group">
                    <td className="py-3 px-3">
                      <Link
                        to="/ward/$id/analytics"
                        params={{ id: w.ward }}
                        className="font-semibold text-white group-hover:text-cyan-400 transition inline-flex items-center gap-1.5"
                      >
                        {w.ward}
                        <ChevronRight className="size-3 text-slate-500 group-hover:text-cyan-400 transition" />
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{w.count} patients</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${w.avgRisk >= 60 ? "bg-rose-400" : w.avgRisk >= 40 ? "bg-amber-400" : "bg-cyan-400"}`}
                            style={{ width: `${w.avgRisk}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-200">{w.avgRisk}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {w.critical > 0 ? (
                        <span className="text-xs font-semibold text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/30">
                          {w.critical} Critical
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs ${w.avgRisk >= 50 ? "text-amber-400" : "text-emerald-400"}`}>
                        {w.avgRisk >= 50 ? "Elevated Care Required" : "Normal Operation"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
