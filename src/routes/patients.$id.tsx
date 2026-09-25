import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Activity, Droplet, Thermometer, Wind, Sparkles,
  AlertTriangle, RefreshCw, Zap, Clock, Brain, ChevronRight,
  ShieldAlert, PhoneCall, PlusCircle, CheckCircle, FileText, Check, AlertCircle, Play
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RiskRing } from "@/components/RiskRing";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, ReferenceLine
} from "recharts";
import {
  api, createPatientVitalsWebSocket,
  type VitalReading, type RiskAssessment, type AlertEvent, type TriageSummary
} from "@/lib/api";

export const Route = createFileRoute("/patients/$id")({
  head: () => ({ meta: [{ title: "Patient Clinical Workspace · EaglesEye AI" }] }),
  component: PatientDetails,
});

const SEVERITY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40" },
  high:     { label: "High Risk", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40" },
  moderate: { label: "Monitor",   bg: "bg-sky-500/15",   text: "text-sky-400",   border: "border-sky-500/40" },
  low:      { label: "Stable",    bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
};

const tooltipStyle = {
  contentStyle: { background: "#0b1120", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
};

function TelemetryCard({
  label, value, unit, normalRange, isAbnormal, abnormalLabel, icon
}: {
  label: string; value: string | number; unit: string; normalRange: string;
  isAbnormal?: boolean; abnormalLabel?: string; icon: React.ReactNode;
}) {
  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between transition ${
      isAbnormal
        ? "bg-rose-950/25 border-rose-500/50 shadow-md shadow-rose-950/30"
        : "bg-slate-900/60 border-white/10"
    }`}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">{icon} {label}</span>
        {isAbnormal && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            {abnormalLabel || "ABNORMAL"}
          </span>
        )}
      </div>

      <div className="my-2">
        <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${
          isAbnormal ? "text-rose-300" : "text-white"
        }`}>
          {value}
          <span className="text-xs font-normal text-slate-400 ml-1.5">{unit}</span>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-2 border-t border-white/5 flex justify-between">
        <span>Reference Band:</span>
        <span className="font-mono text-slate-300">{normalRange}</span>
      </div>
    </div>
  );
}

function PatientDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<any>(null);
  const [vitals, setVitals] = useState<VitalReading | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalReading[]>([]);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [riskHistory, setRiskHistory] = useState<{ ts: string; risk_score: number }[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [explainability, setExplainability] = useState<any>(null);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [triage, setTriage] = useState<TriageSummary | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Quick Ingest Modal State
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectVitals, setInjectVitals] = useState({
    hr: 135, bp_sys: 80, bp_dia: 50, spo2: 86, temp: 39.2, rr: 28
  });
  const [injecting, setInjecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, v, vh, r, rh, pred, expl, al, tl] = await Promise.all([
        api.getPatient(id),
        api.getLatestVitals(id).catch(() => null),
        api.getVitalsHistory(id, 40).catch(() => []),
        api.getCurrentRisk(id).catch(() => null),
        api.getRiskHistory(id).catch(() => []),
        api.getPrediction(id).catch(() => null),
        api.getExplainability(id).catch(() => null),
        api.getAlerts({ patient_id: id }).catch(() => []),
        api.getTimeline(id).catch(() => []),
      ]);

      setPatient(p);
      if (p?.triage) setTriage(prev => (prev || p.triage) as TriageSummary);
      setVitals(v);
      setVitalsHistory(vh as VitalReading[]);
      setRisk(r as RiskAssessment);
      setRiskHistory((rh as any[]).map((x: any) => ({ ts: x.ts || "", risk_score: x.risk_score })));
      setPrediction(pred);
      setExplainability(expl);
      setAlerts(al);
      setTimelineEvents(tl);
    } catch (e: any) {
      if (e?.message?.includes("404")) setNotFound(true);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();

    // WebSocket for live per-patient stream
    const ws = createPatientVitalsWebSocket(id, (data: any) => {
      if (data?.vitals) setVitals(data.vitals);
      if (data?.risk) setRisk(data.risk);
      if (data?.new_alerts?.length) {
        setAlerts(prev => [...data.new_alerts, ...prev]);
      }
    });

    const poll = setInterval(load, 10000);
    return () => {
      ws.close();
      clearInterval(poll);
    };
  }, [id, load]);

  const handleRunTriage = async () => {
    setTriageLoading(true);
    try {
      const result = await api.generateTriage(id);
      setTriage(result);
      await load();
    } catch (e) {
      console.error("Triage generation error:", e);
    } finally {
      setTriageLoading(false);
    }
  };

  const handleInjectVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setInjecting(true);
    try {
      await api.postVitals(id, injectVitals);
      setShowInjectModal(false);
      // Wait for AI background pipeline
      setTimeout(load, 1500);
    } catch (err) {
      console.error("Inject vitals failed:", err);
    } finally {
      setInjecting(false);
    }
  };

  const handleAlertAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAlertResolve = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAlertEscalate = async (alertId: string) => {
    try {
      await api.escalateAlert(alertId);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-24 text-center text-slate-400">
          <RefreshCw className="size-6 animate-spin mx-auto mb-3 text-cyan-400" />
          Synchronizing clinical workspace for patient {id}...
        </div>
      </AppShell>
    );
  }

  if (notFound || !patient) {
    return (
      <AppShell>
        <div className="clinical-panel rounded-2xl p-12 text-center max-w-lg mx-auto mt-12 space-y-4">
          <h2 className="text-xl font-bold text-white">Patient Record Not Found</h2>
          <p className="text-xs text-slate-400">No active telemetry file corresponds to ID {id}.</p>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
            <ArrowLeft className="size-3.5" /> Return to Command Center
          </Link>
        </div>
      </AppShell>
    );
  }

  const currentVitals = vitals ?? (patient as any).vitals ?? {};
  const currentRisk = risk ?? (patient as any).risk ?? {};
  const score = Math.round(currentRisk.risk_score || patient.risk_score || 0);
  const severityKey = currentRisk.severity || patient.severity || "low";
  const badge = SEVERITY_BADGES[severityKey] || SEVERITY_BADGES.low;

  // Abnormality Flags
  const spo2Val = currentVitals.spo2 ?? 98;
  const hrVal = currentVitals.hr ?? 75;
  const sbpVal = currentVitals.bp_sys ?? 120;
  const tempVal = currentVitals.temp ?? 37.0;
  const rrVal = currentVitals.rr ?? 16;

  // Chart data
  const chartData = vitalsHistory.map((v, i) => ({
    t: `-${(vitalsHistory.length - i - 1) * 5}m`,
    spo2: Math.round(v.spo2),
    hr: Math.round(v.hr),
    bp_sys: Math.round(v.bp_sys),
    bp_dia: Math.round(v.bp_dia),
    temp: Number(v.temp.toFixed(1)),
    rr: Math.round(v.rr),
  }));

  const riskChartData = riskHistory.map((r, i) => ({
    t: `-${(riskHistory.length - i - 1) * 5}m`,
    risk: Math.round(r.risk_score),
  }));

  const trajectoryData = prediction?.trajectory?.map((pt: any) => ({
    t: `+${pt.t_minutes}m`,
    risk: Math.round(pt.predicted_risk),
  })) ?? [];

  const combinedRiskChart = [...riskChartData, ...trajectoryData];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Top Navigation & Patient Master Header */}
        <div className="flex flex-col gap-3 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="size-3.5" /> Back to Command Center
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInjectModal(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <PlusCircle className="size-3.5" /> Ingest Test Vitals
              </button>
              <button
                onClick={load}
                className="p-1.5 rounded-lg glass text-slate-400 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Master Patient Identification Banner */}
          <div className="clinical-panel rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-l-4 border-l-cyan-400">
            <div className="flex items-start gap-5">
              <RiskRing score={score} size={72} />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300">
                    {patient.id}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {badge.label} Acuity
                  </span>
                  <span className="text-xs text-slate-400">
                    Trend: <span className="text-white font-semibold capitalize">{currentRisk.trend || "Stable"}</span>
                  </span>
                  {currentRisk.ai_degraded && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/40">
                      ⚠ AI Degraded (Rules Fallback)
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {patient.name}
                </h1>

                <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
                  <span>Age: <strong className="text-white">{patient.age}{patient.gender}</strong></span>
                  <span>·</span>
                  <span>Location: <strong className="text-white">{patient.ward} · Room {patient.room}</strong></span>
                  <span>·</span>
                  <span>Admitted: <strong className="text-white">Day {patient.admitted_days}</strong></span>
                  <span>·</span>
                  <span>Nurse: <strong className="text-emerald-400">{patient.assigned_nurse || "Unassigned"}</strong></span>
                </div>

                <div className="text-xs text-slate-400 pt-1">
                  Primary Admitting Diagnosis: <strong className="text-cyan-300 font-semibold">{patient.diagnosis}</strong>
                </div>
              </div>
            </div>

            {/* Quick Action Clinical Buttons */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <button
                onClick={handleRunTriage}
                disabled={triageLoading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs hover:shadow-lg hover:shadow-purple-500/25 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Brain className={`size-4 ${triageLoading ? "animate-pulse" : ""}`} />
                {triageLoading ? "Consulting Groq LLaMA 3.1..." : "Run AI Clinical Triage"}
              </button>

              <Link
                to="/alerts"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <ShieldAlert className="size-4 text-rose-400" />
                Alerts ({alerts.length})
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION 1: OBSERVED TELEMETRY (Real Vital Signs with Clinical Reference Ranges) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="size-3.5 text-cyan-400" /> Current Observed Telemetry (Sensor Ingestion)
            </h2>
            <span className="text-[11px] text-slate-500">Auto-refreshing via WebSocket stream</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* SpO2 */}
            <TelemetryCard
              label="SpO₂ Oxygen"
              value={Math.round(spo2Val)}
              unit="%"
              normalRange="95% – 100%"
              isAbnormal={spo2Val < 92}
              abnormalLabel={spo2Val < 90 ? "CRITICAL HYPOXIA" : "MILD HYPOXIA"}
              icon={<Wind className="size-4 text-cyan-400" />}
            />

            {/* Heart Rate */}
            <TelemetryCard
              label="Heart Rate"
              value={Math.round(hrVal)}
              unit="bpm"
              normalRange="60 – 100 bpm"
              isAbnormal={hrVal > 105 || hrVal < 55}
              abnormalLabel={hrVal > 105 ? "TACHYCARDIA" : "BRADYCARDIA"}
              icon={<Activity className="size-4 text-amber-400" />}
            />

            {/* Blood Pressure */}
            <TelemetryCard
              label="Blood Pressure"
              value={`${Math.round(sbpVal)}/${Math.round(currentVitals.bp_dia ?? 80)}`}
              unit="mmHg"
              normalRange="90/60 – 130/85"
              isAbnormal={sbpVal < 90 || sbpVal > 140}
              abnormalLabel={sbpVal < 90 ? "HYPOTENSION" : "HYPERTENSION"}
              icon={<Droplet className="size-4 text-rose-400" />}
            />

            {/* Temperature */}
            <TelemetryCard
              label="Temperature"
              value={tempVal.toFixed(1)}
              unit="°C"
              normalRange="36.5°C – 37.5°C"
              isAbnormal={tempVal > 38.0 || tempVal < 35.8}
              abnormalLabel={tempVal > 38.0 ? "FEVER" : "HYPOTHERMIA"}
              icon={<Thermometer className="size-4 text-purple-400" />}
            />

            {/* Respiration Rate */}
            <TelemetryCard
              label="Respiratory Rate"
              value={Math.round(rrVal)}
              unit="br/min"
              normalRange="12 – 20 br/min"
              isAbnormal={rrVal > 22 || rrVal < 10}
              abnormalLabel={rrVal > 22 ? "TACHYPNEA" : "BRADYPNEA"}
              icon={<Wind className="size-4 text-emerald-400" />}
            />
          </div>
        </div>

        {/* SECTION 2: AI CLINICAL INTELLIGENCE LAYER */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Card 1: Risk & Trajectory Forecast (Model Output) */}
          <div className="clinical-panel rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-cyan-300">
                  <Sparkles className="size-3.5" /> Deterioration Engine
                </span>
                <span className="font-mono text-[10px]">Model: {currentRisk.model_version || "hybrid-v1"}</span>
              </div>

              <div className="mt-3 flex items-baseline gap-3">
                <div className="text-4xl font-extrabold text-white tabular-nums">
                  {score}%
                </div>
                <div className="text-xs text-slate-400">
                  Confidence: <strong className="text-white">{Math.round(currentRisk.confidence || 90)}%</strong>
                </div>
              </div>

              {/* Time to Critical Highlight */}
              {prediction?.time_to_critical_min != null ? (
                <div className="mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center gap-3">
                  <Zap className="size-5 text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-rose-300">
                      Time to Critical Decompensation: ~{Math.round(prediction.time_to_critical_min)} mins
                    </div>
                    <div className="text-[11px] text-rose-200/80">
                      Predicted Likelihood: {Math.round(prediction.likelihood_pct)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                  <CheckCircle className="size-4 text-emerald-400" />
                  <span>Trajectory Stable — No critical decompensation projected in next 60m.</span>
                </div>
              )}

              {/* Projected Points Table */}
              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Projected Risk Trajectory (Minutes Ahead)
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {trajectoryData.map((pt: any) => (
                    <div key={pt.t} className="p-2 rounded-lg bg-slate-950/70 border border-white/5">
                      <div className="text-[10px] text-slate-400">{pt.t}</div>
                      <div className={`font-bold font-mono mt-0.5 ${pt.risk >= 70 ? "text-rose-400" : pt.risk >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                        {pt.risk}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 text-[10px] text-slate-500">
              Blends 60% clinical weighted rules with 40% XGBoost deterioration classifier.
            </div>
          </div>

          {/* Card 2: SHAP-Style Explainability Matrix (Why is patient at risk?) */}
          <div className="clinical-panel rounded-2xl p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-cyan-300">
                <FileText className="size-3.5" /> Explainable AI Attribution Matrix
              </span>
              <span className="text-[11px] text-slate-400">SHAP-style Feature Weights</span>
            </div>

            {explainability?.factors?.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-300 leading-relaxed font-medium">
                  {explainability.reasoning_trace || "Risk score is actively driven by co-occurring physiological threshold violations."}
                </div>

                <div className="space-y-2 pt-1">
                  {explainability.factors.map((f: any, idx: number) => {
                    const pct = Math.round(f.contribution_pct || 20);
                    return (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-cyan-400" />
                            {f.factor.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-cyan-300 font-bold">
                            {pct}% Contribution
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Recorded: <strong className="text-slate-200">{f.value}</strong></span>
                          <span>Clinical Threshold: <strong className="text-slate-200">{f.threshold} ({f.direction})</strong></span>
                          <span>Clinical Weight: <strong className="text-slate-200">{f.weight} pts</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Patient is currently within baseline limits. No abnormal feature attributions recorded.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: GROQ LLM CLINICAL TRIAGE ASSISTANT (Evidence-Driven CDS) */}
        <div className="clinical-panel rounded-2xl p-5 border-l-4 border-l-purple-500 space-y-4">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5 flex-wrap gap-2">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-purple-300 text-sm">
              <Brain className="size-4 text-purple-400" /> AI Clinical Decision Support (Groq LLaMA 3.1 70B)
            </span>
            {triage ? (
              triage.ai_degraded ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  Deterministic Template Fallback
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  Schema-Constrained LLM Output
                </span>
              )
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40">
                Ready to Consult
              </span>
            )}
          </div>

          {triage ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current Condition</div>
                <div className="text-slate-200 font-medium leading-relaxed">{triage.condition}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Clinical Concern</div>
                <div className="text-amber-200 font-bold leading-relaxed">{triage.clinical_concern}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Predicted Outcome</div>
                <div className="text-slate-200 font-medium leading-relaxed">{triage.predicted_outcome}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-purple-300">Recommended Actions</div>
                <ul className="space-y-1 text-slate-200">
                  {(triage.recommended_actions || []).map((action: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px]">
                      <Check className="size-3 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-purple-950/15 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <p className="text-slate-200 font-medium">
                  Evidence-driven clinical triage summary has not been generated for this patient's current telemetry window.
                </p>
                <p className="text-slate-400 text-[11px]">
                  Groq LLaMA 3.1 70B synthesizes vital trends, deterioration likelihood, and SHAP factor attributions into actionable triage insights.
                </p>
              </div>
              <button
                onClick={handleRunTriage}
                disabled={triageLoading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs hover:shadow-lg hover:shadow-purple-500/25 transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Brain className={`size-4 ${triageLoading ? "animate-pulse" : ""}`} />
                {triageLoading ? "Consulting Groq LLaMA 3.1..." : "Run AI Clinical Triage"}
              </button>
            </div>
          )}
        </div>

        {/* SECTION 4: ACTIVE ALERTS & RAPID ESCALATION */}
        {alerts.length > 0 && (
          <div className="clinical-panel rounded-2xl p-5 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="size-4" /> Active Clinical Alarms for this Patient ({alerts.length})
              </span>
              <span className="text-[11px] text-slate-400">Correlated &amp; De-duplicated</span>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {alerts.map(a => (
                <div key={a.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase">{a.abnormality_type}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.severity === "critical" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                      }`}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{a.message}</p>
                    <div className="text-[10px] text-slate-500">
                      Status: <strong className="text-slate-300 uppercase">{a.status}</strong> · {new Date(a.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    {a.status === "generated" && (
                      <button
                        onClick={() => handleAlertAcknowledge(a.id)}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition"
                      >
                        Acknowledge
                      </button>
                    )}
                    {a.status !== "resolved" && (
                      <button
                        onClick={() => handleAlertResolve(a.id)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-medium transition"
                      >
                        Resolve
                      </button>
                    )}
                    {a.status !== "escalated" && (
                      <button
                        onClick={() => handleAlertEscalate(a.id)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="size-3" /> Voice Call Doctor
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: HISTORICAL TIME-SERIES CHARTS */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chart A: Multi-Parameter Physiological Trends */}
          <div className="clinical-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-200">
                SpO₂ &amp; Heart Rate Waveform History (Last 60m)
              </span>
              <span className="text-[10px]">Reference Lines Enabled</span>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis domain={[50, 150]} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <ReferenceLine y={90} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "SpO2 Crit (90%)", fill: "#f43f5e", fontSize: 9 }} />
                  <ReferenceLine y={105} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "HR High (105)", fill: "#f59e0b", fontSize: 9 }} />
                  <Line type="monotone" dataKey="hr" stroke="#fb923c" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
                  <Line type="monotone" dataKey="spo2" stroke="#38bdf8" strokeWidth={2.5} dot={false} name="SpO2 (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart B: Deterioration Trajectory Forecast */}
          <div className="clinical-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-200">
                Risk Trajectory (Observed History &rarr; 60m Forecast)
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Deterioration Slope Extrapolated</span>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedRiskChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Critical Escalation (80%)", fill: "#f43f5e", fontSize: 9 }} />
                  <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2.5} fill="url(#riskAreaGradient)" name="Risk Score %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SECTION 6: AUDIT TRAIL / CLINICAL TIMELINE */}
        <div className="clinical-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-200">
              <Clock className="size-3.5 text-cyan-400" /> Patient Audit Ledger (Chronological Pipeline Trail)
            </span>
            <span className="text-[10px] font-mono">{timelineEvents.length} Events Logged</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {timelineEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No timeline events recorded yet. Ingest vitals or launch a simulation.
              </div>
            ) : (
              timelineEvents.map((evt: any) => (
                <div key={evt.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                      {evt.event_type}
                    </span>
                    <span className="text-slate-200 truncate">
                      {evt.payload?.message || evt.payload?.condition || `Telemetry recorded (Risk: ${evt.payload?.risk_score != null ? Math.round(evt.payload.risk_score) : "—"}%)`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {new Date(evt.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* QUICK INGEST TEST VITALS MODAL */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm grid place-items-center p-4">
          <div className="clinical-panel rounded-2xl p-6 max-w-md w-full border border-cyan-400/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <PlusCircle className="size-4 text-cyan-400" /> Simulate Vitals Ingestion
              </h3>
              <button onClick={() => setShowInjectModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Inject custom physiological parameters directly into the live AI pipeline for <strong>{patient.name}</strong>.
            </p>

            <form onSubmit={handleInjectVitals} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={injectVitals.hr}
                    onChange={e => setInjectVitals({ ...injectVitals, hr: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">SpO₂ (%)</label>
                  <input
                    type="number"
                    value={injectVitals.spo2}
                    onChange={e => setInjectVitals({ ...injectVitals, spo2: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={injectVitals.bp_sys}
                    onChange={e => setInjectVitals({ ...injectVitals, bp_sys: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={injectVitals.bp_dia}
                    onChange={e => setInjectVitals({ ...injectVitals, bp_dia: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={injectVitals.temp}
                    onChange={e => setInjectVitals({ ...injectVitals, temp: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Resp Rate (br/min)</label>
                  <input
                    type="number"
                    value={injectVitals.rr}
                    onChange={e => setInjectVitals({ ...injectVitals, rr: Number(e.target.value) })}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setInjectVitals({ hr: 75, bp_sys: 120, bp_dia: 80, spo2: 98, temp: 37.0, rr: 16 })}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-emerald-400 hover:bg-slate-800"
                >
                  Normal Preset
                </button>
                <button
                  type="button"
                  onClick={() => setInjectVitals({ hr: 138, bp_sys: 80, bp_dia: 48, spo2: 86, temp: 39.4, rr: 30 })}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-rose-400 hover:bg-slate-800"
                >
                  Septic Crisis Preset
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowInjectModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={injecting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {injecting ? "Ingesting..." : "Ingest & Recompute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
