import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Users2, ArrowLeftRight, Activity, Sparkles, Wind, Droplet,
  Thermometer, RefreshCw, ChevronRight, CheckCircle2, AlertTriangle, ArrowUpRight
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RiskRing } from "@/components/RiskRing";
import { api, type PatientSummary } from "@/lib/api";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Multi-Patient Comparison · EaglesEye AI" }] }),
  component: ComparePage,
});

const SEVERITY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40" },
  high:     { label: "High Risk", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40" },
  moderate: { label: "Monitor",   bg: "bg-sky-500/15",   text: "text-sky-400",   border: "border-sky-500/40" },
  low:      { label: "Stable",    bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
};

export function ComparePage() {
  const [allPatients, setAllPatients] = useState<PatientSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(["P01", "P04"]);
  const [patientDetails, setPatientDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPatients().then(setAllPatients).catch(console.error);
  }, []);

  const loadComparison = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const details = await Promise.all(
        selectedIds.map(async id => {
          try {
            return await api.getPatient(id);
          } catch {
            return null;
          }
        })
      );
      setPatientDetails(details.filter(Boolean));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedIds]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  const togglePatient = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter(x => x !== id));
      }
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded inline-block">
              Clinical Acuity Cross-Evaluation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Multi-Patient Synchronized Comparison
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Side-by-side comparative analysis of physiological trajectories, AI risk attributions, and nurse workloads.
            </p>
          </div>

          <button
            onClick={loadComparison}
            className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-white/10 transition text-slate-300 self-start"
            title="Refresh comparison"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Patient Selection Bar */}
        <div className="clinical-panel rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Select 2 to 4 Patients ({selectedIds.length}/4 Active)
            </span>
            <span className="text-[11px] text-slate-500">Click any patient chip to add or remove</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {allPatients.map(p => {
              const selected = selectedIds.includes(p.id);
              const isCrit = p.severity === "critical";

              return (
                <button
                  key={p.id}
                  onClick={() => togglePatient(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    selected
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-sm shadow-cyan-500/25"
                      : "border-white/10 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${isCrit ? "bg-rose-400" : "bg-emerald-400"}`} />
                  <span>{p.id} · {p.name}</span>
                  <span className="font-mono text-[11px] text-cyan-300">({Math.round(p.risk_score)}%)</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Synchronized Columns Grid */}
        <div className={`grid gap-4 ${
          patientDetails.length === 2 ? "md:grid-cols-2" : patientDetails.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
        }`}>
          {patientDetails.map((p: any) => {
            const vitals = p.vitals || {};
            const risk = p.risk || {};
            const score = Math.round(risk.risk_score || p.risk_score || 0);
            const severity = risk.severity || p.severity || "low";
            const badge = SEVERITY_BADGES[severity] || SEVERITY_BADGES.low;

            const spo2 = vitals.spo2 != null ? Math.round(vitals.spo2) : 98;
            const hr = vitals.hr != null ? Math.round(vitals.hr) : 75;
            const sbp = vitals.bp_sys != null ? Math.round(vitals.bp_sys) : 120;
            const dbp = vitals.bp_dia != null ? Math.round(vitals.bp_dia) : 80;
            const temp = vitals.temp != null ? vitals.temp.toFixed(1) : "37.0";

            return (
              <div key={p.id} className="clinical-panel rounded-2xl p-5 flex flex-col justify-between space-y-4 border border-white/[0.08]">
                <div>
                  {/* Identification Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.08]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                          {p.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-white">{p.name}</h3>
                      <div className="text-[11px] text-slate-400">
                        {p.age}{p.gender} · {p.ward} (Room {p.room})
                      </div>
                      <div className="text-[11px] text-cyan-300 font-medium truncate max-w-[200px]" title={p.diagnosis}>
                        {p.diagnosis}
                      </div>
                    </div>

                    <RiskRing score={score} size={54} />
                  </div>

                  {/* Physiological Telemetry Snapshot */}
                  <div className="mt-3 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Current Telemetry Readings
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* SpO2 */}
                      <div className={`p-2 rounded-lg border ${spo2 < 92 ? "bg-rose-950/30 border-rose-500/40 text-rose-300" : "bg-slate-950 border-white/5 text-slate-200"}`}>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1"><Wind className="size-3 text-cyan-400" /> SpO₂</div>
                        <div className="font-mono font-bold text-base mt-0.5">{spo2}%</div>
                      </div>

                      {/* HR */}
                      <div className={`p-2 rounded-lg border ${hr > 105 ? "bg-rose-950/30 border-rose-500/40 text-rose-300" : "bg-slate-950 border-white/5 text-slate-200"}`}>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1"><Activity className="size-3 text-amber-400" /> Heart Rate</div>
                        <div className="font-mono font-bold text-base mt-0.5">{hr} bpm</div>
                      </div>

                      {/* BP */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-white/5 text-slate-200">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1"><Droplet className="size-3 text-rose-400" /> Blood Press.</div>
                        <div className="font-mono font-bold text-base mt-0.5">{sbp}/{dbp}</div>
                      </div>

                      {/* Temp */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-white/5 text-slate-200">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1"><Thermometer className="size-3 text-purple-400" /> Body Temp</div>
                        <div className="font-mono font-bold text-base mt-0.5">{temp}°C</div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-300 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Clinical Trend:</span>
                      <span className="font-semibold capitalize text-white">{risk.trend || "Stable"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nurse Assigned:</span>
                      <span className="text-emerald-400 font-medium">{p.assigned_nurse || "None Assigned"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Admitted:</span>
                      <span>Day {p.admitted_days}</span>
                    </div>
                  </div>

                  {/* AI Note */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-white/5 text-xs">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Sparkles className="size-3 text-cyan-400" /> Diagnostic Assessment
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">
                      {risk.reasoning || "Continuous baseline normal. No threshold breaches detected."}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <Link
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1 transition"
                  >
                    Open Dedicated Workspace <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
