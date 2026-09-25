import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Play, Square, RefreshCw, Activity, AlertTriangle, CheckCircle,
  ShieldAlert, ArrowRight, Zap, Database, Cpu, Layers, PhoneCall, Check, ExternalLink
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, type PatientSummary } from "@/lib/api";

export const Route = createFileRoute("/simulator")({
  head: () => ({ meta: [{ title: "Clinical Scenario Simulator · EaglesEye AI" }] }),
  component: SimulatorPage,
});

type SimMode = "stable" | "gradual_decline" | "severe_deterioration";

export function SimulatorPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("P01");
  const [mode, setMode] = useState<SimMode>("severe_deterioration");
  const [duration, setDuration] = useState(120);
  const [activeSims, setActiveSims] = useState<Record<string, any>>({});
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 40));
  };

  const loadData = useCallback(async () => {
    try {
      const [pts, status, latestVitals] = await Promise.all([
        api.getPatients(),
        fetch("http://localhost:8001/api/simulator/status").then(r => r.json()).catch(() => ({ active_simulations: {} })),
        api.getLatestVitals(selectedPatient).catch(() => null),
      ]);
      setPatients(pts);
      setActiveSims(status.active_simulations || {});
      if (latestVitals) setPatientVitals(latestVitals);
    } catch (e) {
      console.error(e);
    }
  }, [selectedPatient]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStart = async () => {
    setLoading(true);
    try {
      addLog(`Initiating '${mode}' scenario for ${selectedPatient} (${duration}s duration)...`);
      const res = await api.startSimulation(selectedPatient, mode, duration);
      addLog(`Sensor telemetry loop active. Simulation Run ID: ${res.run_id}`);
      addLog(`Feeding multi-parameter streams into TimescaleDB hypertable.`);
      await loadData();
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (pid: string) => {
    try {
      addLog(`Terminating simulation loop for patient ${pid}...`);
      await api.stopSimulation(pid);
      addLog(`Sensor stream closed for ${pid}. Pipeline standing by.`);
      await loadData();
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    }
  };

  const currentSimInfo = activeSims[selectedPatient];
  const isRunning = Boolean(currentSimInfo);
  const targetPatient = patients.find(p => p.id === selectedPatient);

  // Pipeline stages for causal chain visualization
  const pipelineStages = [
    { title: "Sensor Tick", desc: "Vitals Generated", icon: Activity, active: isRunning },
    { title: "TimescaleDB", desc: "Hypertable Write", icon: Database, active: isRunning },
    { title: "Risk Engine", desc: "XGBoost + Rules", icon: Cpu, active: isRunning },
    { title: "Correlation", desc: "Redis 300s Window", icon: Layers, active: isRunning },
    { title: "Priority Queue", desc: "Redis ZADD Ranked", icon: Zap, active: isRunning },
    { title: "Voice Call", desc: "Vapi Auto-Dispatch", icon: PhoneCall, active: isRunning && mode === "severe_deterioration" },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded inline-block">
              IoMT Hardware Simulator
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Clinical Scenario Simulator
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live verification of the complete causal perception &rarr; response chain without physical patient hardware.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-white/10 transition text-slate-300"
              title="Refresh simulator state"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* VISUAL CAUSAL CHAIN BANNER */}
        <div className="clinical-panel rounded-2xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
            <span className="font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Zap className="size-3.5 text-cyan-400" /> End-to-End Causal Pipeline Flow
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {isRunning ? "Pipeline Active & Ingesting" : "Pipeline Idle"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {pipelineStages.map((stage, idx) => {
              const Icon = stage.icon;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition relative ${
                    stage.active
                      ? "bg-cyan-950/40 border-cyan-400/50 shadow-md shadow-cyan-950/30"
                      : "bg-slate-950/40 border-white/5 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`size-4 ${stage.active ? "text-cyan-300" : "text-slate-500"}`} />
                    <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-bold text-white">{stage.title}</div>
                    <div className="text-[10px] text-slate-400">{stage.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulator Control & Target Preview Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Simulation Configuration */}
          <div className="clinical-panel rounded-2xl p-5 lg:col-span-2 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="size-4 text-cyan-400" /> Scenario Parameters
            </h2>

            {/* Target Patient Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Patient Bed
              </label>
              <select
                value={selectedPatient}
                onChange={e => setSelectedPatient(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name} ({p.ward}, Room {p.room}, Current Risk: {Math.round(p.risk_score)}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Simulation Scenarios (README modes) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Clinical Deterioration Archetype
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Mode 1: Stable */}
                <button
                  type="button"
                  onClick={() => setMode("stable")}
                  className={`p-4 rounded-xl border text-left transition ${
                    mode === "stable"
                      ? "border-emerald-400/80 bg-emerald-950/30 text-white shadow-sm"
                      : "border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                    <CheckCircle className="size-4" /> Stable Normal
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Normal baseline fluctuations. HR ~75, SpO2 ~98%, BP ~120/80. Low acuity.
                  </p>
                </button>

                {/* Mode 2: Gradual Decline */}
                <button
                  type="button"
                  onClick={() => setMode("gradual_decline")}
                  className={`p-4 rounded-xl border text-left transition ${
                    mode === "gradual_decline"
                      ? "border-amber-400/80 bg-amber-950/30 text-white shadow-sm"
                      : "border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                    <AlertTriangle className="size-4" /> Gradual Drift
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Systematic multi-vital degradation over the session duration. High vigilance.
                  </p>
                </button>

                {/* Mode 3: Severe Deterioration */}
                <button
                  type="button"
                  onClick={() => setMode("severe_deterioration")}
                  className={`p-4 rounded-xl border text-left transition ${
                    mode === "severe_deterioration"
                      ? "border-rose-400/80 bg-rose-950/30 text-white shadow-sm"
                      : "border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400">
                    <ShieldAlert className="size-4" /> Severe Crisis
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Acute Septic / Respiratory collapse. Triggers correlated alerts &amp; voice call.
                  </p>
                </button>
              </div>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Session Duration (Seconds)
              </label>
              <div className="flex gap-2">
                {[60, 120, 180, 300].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      duration === d
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "border-white/10 bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    {d}s ({d / 60}m)
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/5">
              <button
                onClick={handleStart}
                disabled={loading || isRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold text-xs hover:shadow-lg hover:shadow-cyan-500/30 transition disabled:opacity-50"
              >
                <Play className="size-3.5 fill-current" />
                {loading ? "Initializing..." : isRunning ? "Feed Active" : "Launch Telemetry Stream"}
              </button>

              {isRunning && (
                <button
                  onClick={() => handleStop(selectedPatient)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold transition"
                >
                  <Square className="size-3.5 fill-current" />
                  Abort Stream
                </button>
              )}

              {targetPatient && (
                <Link
                  to="/patients/$id"
                  params={{ id: targetPatient.id }}
                  className="ml-auto text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Inspect in Workspace <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Right Col: Live Patient Telemetry Monitor Preview */}
          <div className="clinical-panel rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                <span className="font-semibold uppercase tracking-wider text-slate-200">
                  Target Telemetry Preview
                </span>
                <span className="live-dot" />
              </div>

              {targetPatient ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm">{targetPatient.name}</h3>
                      <div className="text-[11px] text-slate-400">{targetPatient.id} · {targetPatient.ward}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-mono font-bold text-white tabular-nums">
                        {Math.round(targetPatient.risk_score)}%
                      </div>
                      <div className="text-[10px] uppercase text-cyan-300 font-semibold">{targetPatient.severity}</div>
                    </div>
                  </div>

                  {/* Real-time vitals preview */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <div className="text-[10px] text-slate-400">SpO₂ Oxygen</div>
                      <div className={`text-base font-bold font-mono ${patientVitals?.spo2 < 92 ? "text-rose-400" : "text-white"}`}>
                        {patientVitals?.spo2 != null ? `${Math.round(patientVitals.spo2)}%` : "—"}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <div className="text-[10px] text-slate-400">Heart Rate</div>
                      <div className={`text-base font-bold font-mono ${patientVitals?.hr > 105 ? "text-amber-400" : "text-white"}`}>
                        {patientVitals?.hr != null ? `${Math.round(patientVitals.hr)} bpm` : "—"}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <div className="text-[10px] text-slate-400">Blood Pressure</div>
                      <div className="text-base font-bold font-mono text-white">
                        {patientVitals?.bp_sys != null ? `${Math.round(patientVitals.bp_sys)}/${Math.round(patientVitals.bp_dia)}` : "—"}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <div className="text-[10px] text-slate-400">Temperature</div>
                      <div className="text-base font-bold font-mono text-white">
                        {patientVitals?.temp != null ? `${patientVitals.temp.toFixed(1)}°C` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Progress bar if running */}
              {isRunning && currentSimInfo && (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-cyan-300 font-semibold">
                    <span>Ticks Generated</span>
                    <span className="font-mono">{currentSimInfo.ticks_generated} / {currentSimInfo.total_ticks}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, (currentSimInfo.ticks_generated / (currentSimInfo.total_ticks || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-500 pt-3 border-t border-white/5">
              Ticks are directly dispatched to backend AI pipeline via async queues.
            </div>
          </div>
        </div>

        {/* Live Simulator Event Log Terminal */}
        <div className="clinical-panel rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
            <span className="font-mono uppercase font-semibold text-slate-200">
              Pipeline Telemetry Event Console
            </span>
            <span className="text-[11px] font-mono text-slate-500">Live Buffer</span>
          </div>

          <div className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-white/5 h-44 overflow-y-auto space-y-1 leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">
                Simulator standing by. Select a scenario and launch above to view live telemetry events.
              </div>
            ) : (
              logs.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
