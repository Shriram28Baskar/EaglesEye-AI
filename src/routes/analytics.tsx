import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, AlertTriangle, HeartPulse, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { usePatients } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · EaglesEye AI" }] }),
  component: Analytics,
});

const COLORS: Record<string, string> = {
  Critical: "oklch(0.7 0.22 25)",
  "High Risk": "oklch(0.8 0.18 75)",
  Monitor: "oklch(0.75 0.15 230)",
  Stable: "oklch(0.75 0.17 150)",
};

const tooltipStyle = {
  contentStyle: { background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
};

function Analytics() {
  const patients = usePatients();

  const dist = useMemo(() => {
    const buckets = ["Stable","Monitor","High Risk","Critical"] as const;
    return buckets.map(b => ({ name: b, value: patients.filter(p => p.status === b).length, fill: COLORS[b] }));
  }, [patients]);

  const wards = useMemo(() => {
    const m = new Map<string, { ward: string; avgRisk: number; critical: number; count: number; sum: number }>();
    patients.forEach(p => {
      const w = m.get(p.ward) ?? { ward: p.ward, avgRisk: 0, critical: 0, count: 0, sum: 0 };
      w.count++; w.sum += p.riskScore;
      if (p.status === "Critical") w.critical++;
      w.avgRisk = Math.round(w.sum / w.count);
      m.set(p.ward, w);
    });
    return [...m.values()].sort((a,b) => b.avgRisk - a.avgRisk);
  }, [patients]);

  const alertsByHour = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      h: `${String(((new Date().getHours() - 11 + i) + 24) % 24).padStart(2,"0")}:00`,
      alerts: Math.max(0, Math.round(2 + Math.sin(i / 2) * 3 + (i === 11 ? patients.filter(p=>p.alert).length / 2 : Math.random() * 2))),
    }));
  }, [patients]);

  const critical = patients.filter(p => p.status === "Critical").length;
  const highRisk = patients.filter(p => p.status === "High Risk").length;
  const avgRisk = Math.round(patients.reduce((s, p) => s + p.riskScore, 0) / patients.length);
  const alerts = patients.filter(p => p.alert).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-900"><BarChart3 className="size-5" /></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-slate-400">Hospital-wide risk &amp; response insights</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Avg Risk" value={`${avgRisk}%`} icon={<TrendingUp className="size-5" />} accent="cyan" />
          <StatCard label="Critical" value={critical} icon={<HeartPulse className="size-5" />} accent="rose" />
          <StatCard label="High Risk" value={highRisk} icon={<AlertTriangle className="size-5" />} accent="amber" />
          <StatCard label="Alerts (12h)" value={alertsByHour.reduce((s,x)=>s+x.alerts,0)} icon={<BarChart3 className="size-5" />} accent="emerald" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Risk Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {dist.map((d, i) => <Cell key={i} fill={d.fill} stroke="rgba(0,0,0,0.3)" />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <h3 className="font-semibold text-sm mb-3">Ward Performance — Average Risk Score</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={wards} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="ward" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="avgRisk" radius={[6,6,0,0]}>
                    {wards.map((w, i) => (
                      <Cell key={i} fill={w.avgRisk >= 70 ? COLORS.Critical : w.avgRisk >= 50 ? COLORS["High Risk"] : COLORS.Monitor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-3">Alert Volume — Last 12 Hours</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={alertsByHour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="h" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="alerts" fill="oklch(0.75 0.17 220)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-3">Ward Detail</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="py-2 px-3">Ward</th>
                  <th className="py-2 px-3">Patients</th>
                  <th className="py-2 px-3">Critical</th>
                  <th className="py-2 px-3">Avg Risk</th>
                  <th className="py-2 px-3">Load</th>
                </tr>
              </thead>
              <tbody>
                {wards.map(w => (
                  <tr key={w.ward} className="border-b border-white/5">
                    <td className="py-2 px-3 font-medium">{w.ward}</td>
                    <td className="py-2 px-3 tabular-nums">{w.count}</td>
                    <td className="py-2 px-3 tabular-nums text-rose-300">{w.critical}</td>
                    <td className="py-2 px-3 tabular-nums">{w.avgRisk}%</td>
                    <td className="py-2 px-3">
                      <div className="h-1.5 w-32 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full" style={{ width: `${w.avgRisk}%`, background: w.avgRisk >= 70 ? COLORS.Critical : w.avgRisk >= 50 ? COLORS["High Risk"] : COLORS.Monitor }} />
                      </div>
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
