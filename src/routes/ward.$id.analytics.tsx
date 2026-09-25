import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  BarChart3, AlertTriangle, HeartPulse, TrendingUp, Users, RefreshCw,
  Building2, ArrowLeft, BedDouble, ShieldCheck, ChevronRight
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { RiskRing } from "@/components/RiskRing";
import { api, type PatientSummary } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";

export const Route = createFileRoute("/ward/$id/analytics")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} Ward Analytics · EaglesEye AI` }] }),
  component: WardAnalyticsDetail,
});

interface WardAnalyticsData {
  ward: string;
  patient_count: number;
  avg_risk: number;
  critical_pct: number;
  active_alerts: number;
  avg_response_time_min: number;
  risk_distribution: {
    critical: number;
    high: number;
    moderate: number;
    stable: number;
  };
  occupancy_pct: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f43f5e",
  high: "#f59e0b",
  moderate: "#38bdf8",
  stable: "#10b981",
};

const tooltipStyle = {
  contentStyle: { background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
};

export function WardAnalyticsDetail() {
  const { id } = useParams({ from: "/ward/$id/analytics" });
  const [wardData, setWardData] = useState<WardAnalyticsData | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [wData, allPts] = await Promise.all([
        api.getWardAnalytics(id) as Promise<WardAnalyticsData>,
        api.getPatients().catch(() => []),
      ]);
      setWardData(wData);
      setPatients(allPts.filter(p => p.ward.toLowerCase() === id.toLowerCase()));
    } catch (e) {
      console.error("Failed to load ward analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const distChartData = wardData?.risk_distribution ? [
    { name: "Stable", value: wardData.risk_distribution.stable, fill: SEVERITY_COLORS.stable },
    { name: "Monitor", value: wardData.risk_distribution.moderate, fill: SEVERITY_COLORS.moderate },
    { name: "High Risk", value: wardData.risk_distribution.high, fill: SEVERITY_COLORS.high },
    { name: "Critical", value: wardData.risk_distribution.critical, fill: SEVERITY_COLORS.critical },
  ] : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/analytics" className="hover:text-cyan-400 transition flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> All Wards
          </Link>
          <span>/</span>
          <span className="text-white font-semibold flex items-center gap-1">
            <Building2 className="size-3.5 text-cyan-400" /> Ward {id}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                Ward {id} Command Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                Live Sensor Sync
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Real-time clinical throughput, patient acuity triage, and response telemetry.
            </p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl glass hover:bg-white/10 transition text-slate-300"
            title="Refresh Ward"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Ward Occupancy"
            value={`${wardData?.occupancy_pct ?? 0}%`}
            icon={<BedDouble className="size-5" />}
            accent="cyan"
            sub={`${wardData?.patient_count ?? 0} active beds monitored`}
          />
          <StatCard
            label="Average Risk"
            value={`${wardData?.avg_risk ?? 0}%`}
            icon={<HeartPulse className="size-5" />}
            accent={wardData && wardData.avg_risk >= 60 ? "rose" : wardData && wardData.avg_risk >= 40 ? "amber" : "emerald"}
            sub="ward composite score"
          />
          <StatCard
            label="Critical Ratio"
            value={`${wardData?.critical_pct ?? 0}%`}
            icon={<TrendingUp className="size-5" />}
            accent="rose"
            sub="immediate physician review"
          />
          <StatCard
            label="Active Alerts"
            value={wardData?.active_alerts ?? 0}
            icon={<AlertTriangle className="size-5" />}
            accent="emerald"
            sub={`Avg response: ${wardData?.avg_response_time_min ?? 0}m`}
          />
        </div>

        {/* Charts & Distribution */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Acuity Distribution */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <HeartPulse className="size-4 text-cyan-400" /> Patient Acuity Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={4}
                  >
                    {distChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, fill: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Ward Patient Roster */}
          <div className="glass rounded-2xl p-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Users className="size-4 text-emerald-400" /> Patients Monitored in {id}
              </h3>
              <span className="text-xs text-slate-400">{patients.length} assigned</span>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1">
              {patients.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No active patients currently assigned to Ward {id}.
                </div>
              ) : (
                patients.map(p => (
                  <Link
                    key={p.id}
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <RiskRing score={p.risk_score} size={36} />
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition flex items-center gap-2">
                          {p.name}
                          <span className="text-[10px] text-slate-500 font-mono">Bed {p.room}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{p.diagnosis}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-xs font-mono font-bold text-slate-300">{p.risk_score}%</span>
                      <ChevronRight className="size-4 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
