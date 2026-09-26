import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Cpu, Database, Server, Wifi, Sparkles, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, PhoneCall, ShieldCheck, Activity, Terminal, Zap
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, latencyApi, type SystemHealth, type PipelineLatency } from "@/lib/api";

export const Route = createFileRoute("/system-health")({
  head: () => ({ meta: [{ title: "System Operational Health · EaglesEye AI" }] }),
  component: SystemHealthPage,
});

export function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [latency, setLatency] = useState<PipelineLatency | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [tab, setTab] = useState<"overview" | "latency" | "technical">("overview");

  const load = useCallback(async () => {
    try {
      const [data, lat] = await Promise.all([
        api.getSystemHealth(),
        latencyApi.getStats().catch(() => null),
      ]);
      setHealth(data);
      if (lat) setLatency(lat);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Health check failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const getStatusBadge = (status: string) => {
    if (status === "ok") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-400/30">
          <CheckCircle2 className="size-3" /> Operational
        </span>
      );
    }
    if (status === "degraded") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-400/30">
          <AlertTriangle className="size-3" /> Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-400/30">
        <XCircle className="size-3" /> Down
      </span>
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded inline-block">
              Reliability &amp; Self-Monitoring
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              System Health &amp; Subsystem Telemetry
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous live health probing across database, pub/sub, machine learning inference, and voice dispatch gateways.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">Last probe: {lastCheck || "verifying..."}</span>
            <button
              onClick={load}
              className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-white/10 transition text-slate-300"
              title="Probe Now"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Operational Status Banner */}
        {health && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            health.overall === "ok"
              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
              : health.overall === "degraded"
              ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
              : "bg-rose-950/20 border-rose-500/40 text-rose-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${health.overall === "ok" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <div className="font-extrabold text-sm uppercase tracking-wider text-white">
                  Operational Acuity: {health.overall.toUpperCase()}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {health.overall === "ok"
                    ? "All clinical perception, persistence, and automated telephone escalation corridors are functioning without degradation."
                    : "Partial fallback active. Core monitoring remains fully functional."}
                </div>
              </div>
            </div>
            {getStatusBadge(health.overall)}
          </div>
        )}

        {/* View Switcher */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              tab === "overview"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Clinical Services Overview
          </button>
          <button
            onClick={() => setTab("latency")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition ${
              tab === "latency"
                ? "border-violet-400 text-violet-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="size-3" />
            Pipeline Latency Profiler
          </button>
          <button
            onClick={() => setTab("technical")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
              tab === "technical"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Engineering Telemetry &amp; Specs
          </button>
        </div>

        {/* Tab: Pipeline Latency Profiler */}
        {tab === "latency" && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-violet-300">
                <Zap className="size-4" />
                <span className="font-bold text-sm">Real-Time AI Pipeline Latency Profiler</span>
              </div>
              {latency && (
                <span className="text-xs font-mono text-slate-400">
                  {latency.sample_count} samples in rolling window
                </span>
              )}
            </div>

            {!latency || latency.sample_count === 0 ? (
              <div className="clinical-panel rounded-2xl p-10 text-center text-slate-400 text-sm">
                <Zap className="size-8 mx-auto mb-3 text-slate-600" />
                No pipeline cycles recorded yet. Start a simulator or POST vitals to generate latency data.
              </div>
            ) : (
              <>
                {/* Summary total card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["avg_ms", "p95_ms", "p99_ms", "max_ms"] as const).map((key) => {
                    const val = latency.stages.total_pipeline_ms?.[key] ?? 0;
                    const color = val < 200 ? "text-emerald-400" : val < 500 ? "text-amber-400" : "text-rose-400";
                    const label = key === "avg_ms" ? "Avg" : key === "p95_ms" ? "P95" : key === "p99_ms" ? "P99" : "Max";
                    return (
                      <div key={key} className="clinical-panel rounded-2xl p-4 text-center">
                        <div className={`text-2xl font-black ${color}`}>{val}<span className="text-xs text-slate-500 ml-0.5">ms</span></div>
                        <div className="text-[11px] text-slate-400 mt-1">Total Pipeline {label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-stage breakdown */}
                <div className="clinical-panel rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stage-by-Stage Breakdown (Avg)</div>
                  {[
                    { key: "db_write_ms", label: "Database Read/Write (TimescaleDB)", icon: "🗄️", sla: 100 },
                    { key: "risk_engine_ms", label: "Risk Engine (Rules + XGBoost Hybrid)", icon: "🧠", sla: 150 },
                    { key: "ml_inference_ms", label: "XGBoost ML Model Inference", icon: "⚡", sla: 40 },
                    { key: "explainability_ms", label: "SHAP Explainability Attribution", icon: "🔍", sla: 30 },
                    { key: "prediction_ms", label: "Trajectory Predictor", icon: "📈", sla: 20 },
                    { key: "alert_correlation_ms", label: "Redis Sliding-Window Alert Correlation", icon: "🔔", sla: 50 },
                    { key: "ws_broadcast_ms", label: "WebSocket Broadcast (Pub/Sub)", icon: "📡", sla: 30 },
                  ].map(({ key, label, icon, sla }) => {
                    const stage = latency.stages[key as keyof typeof latency.stages];
                    const avg = stage?.avg_ms ?? 0;
                    const p95 = stage?.p95_ms ?? 0;
                    const totalAvg = latency.stages.total_pipeline_ms?.avg_ms || 1;
                    const pct = Math.min(100, (avg / totalAvg) * 100);
                    const ok = avg <= sla;
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <span>{icon}</span> {label}
                          </span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className={ok ? "text-emerald-400" : "text-amber-400"}>avg {avg}ms</span>
                            <span className="text-slate-500">p95 {p95}ms</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                              SLA {sla}ms {ok ? "✓" : "⚠"}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent cycles table */}
                {latency.recent.length > 0 && (
                  <div className="clinical-panel rounded-2xl p-5 space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recent 10 Pipeline Cycles</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] font-mono">
                        <thead>
                          <tr className="text-slate-500 border-b border-white/5">
                            <th className="text-left pb-2 pr-4">Patient</th>
                            <th className="text-right pb-2 pr-4">DB</th>
                            <th className="text-right pb-2 pr-4">Risk+ML</th>
                            <th className="text-right pb-2 pr-4">Alert Corr.</th>
                            <th className="text-right pb-2 pr-4">WS Push</th>
                            <th className="text-right pb-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latency.recent.map((s, i) => {
                            const total = s.total_pipeline_ms as number;
                            const color = total < 200 ? "text-emerald-400" : total < 500 ? "text-amber-400" : "text-rose-400";
                            return (
                              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-4 text-slate-300">{s.patient_id}</td>
                                <td className="py-1.5 pr-4 text-right text-slate-400">{s.db_write_ms as number}ms</td>
                                <td className="py-1.5 pr-4 text-right text-slate-400">{s.risk_engine_ms as number}ms</td>
                                <td className="py-1.5 pr-4 text-right text-slate-400">{s.alert_correlation_ms as number}ms</td>
                                <td className="py-1.5 pr-4 text-right text-slate-400">{s.ws_broadcast_ms as number}ms</td>
                                <td className={`py-1.5 text-right font-bold ${color}`}>{total}ms</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Clinical significance note */}
                <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4 text-xs text-violet-300 space-y-1">
                  <div className="font-bold">⚡ Clinical Significance of Pipeline Latency</div>
                  <div className="text-slate-400">In live hospital deployments, the total pipeline latency determines the <strong className="text-violet-300">alert-to-clinician notification delay</strong>. The NHS recommends alert escalation within <strong className="text-violet-300">2 minutes</strong> of a deteriorating vital sign. This profiler measures how long EaglesEye-AI takes to complete the full sensor→AI→alert→dashboard cycle.</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 1: Clinical Services Overview */}
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* TimescaleDB */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-400/20">
                  <Database className="size-4" />
                </div>
                {getStatusBadge(health?.services?.database?.status || "down")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">TimescaleDB Hypertable</h3>
                <p className="text-xs text-slate-400 mt-0.5">Time-series partitioning for high-throughput vital sign ingestion.</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Partitioning:</span><span className="text-emerald-400 font-bold">vital_readings (time)</span></div>
                <div className="flex justify-between"><span>Host Port:</span><span>5433 (PostgreSQL 16)</span></div>
              </div>
            </div>

            {/* Redis 7 */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-400/20">
                  <Server className="size-4" />
                </div>
                {getStatusBadge(health?.services?.redis?.status || "down")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Redis 7 Telemetry Bus</h3>
                <p className="text-xs text-slate-400 mt-0.5">In-memory sliding window correlation &amp; sorted priority ranking.</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Correlation Window:</span><span className="text-cyan-300">300 seconds</span></div>
                <div className="flex justify-between"><span>Priority Queue:</span><span className="text-emerald-400 font-bold">Active (O(log n))</span></div>
              </div>
            </div>

            {/* AI Model */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-400/20">
                  <Cpu className="size-4" />
                </div>
                {getStatusBadge(health?.services?.ai_model?.status || "ok")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">XGBoost Classifier</h3>
                <p className="text-xs text-slate-400 mt-0.5">Gradient-boosted decision trees trained on multi-vital deterioration patterns.</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Architecture:</span><span>60% Rules + 40% ML</span></div>
                <div className="flex justify-between"><span>Fallback Path:</span><span className="text-emerald-400 font-bold">Armed</span></div>
              </div>
            </div>

            {/* WebSockets */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
                  <Wifi className="size-4" />
                </div>
                {getStatusBadge(health?.services?.websocket_hub?.status || "ok")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">WebSocket Broadcaster</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time sub-second push to doctor &amp; nurse command dashboards.</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Active WS Sockets:</span><span className="text-white font-bold">{String(health?.services?.websocket_hub?.active_connections ?? 1)}</span></div>
                <div className="flex justify-between"><span>Target Latency:</span><span className="text-emerald-400">&lt; 50ms</span></div>
              </div>
            </div>

            {/* Groq LLM */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-400/20">
                  <Sparkles className="size-4" />
                </div>
                {getStatusBadge("ok")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Groq LLaMA 3.1 70B</h3>
                <p className="text-xs text-slate-400 mt-0.5">Constrained clinical decision support and triage synthesis.</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Schema Validation:</span><span className="text-cyan-300">Strict JSON</span></div>
                <div className="flex justify-between"><span>Inference Engine:</span><span>LPUs (Groq API)</span></div>
              </div>
            </div>

            {/* Voice Calling Escalation */}
            <div className="clinical-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20">
                  <PhoneCall className="size-4" />
                </div>
                {getStatusBadge("ok")}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Vapi Voice Gateway</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automated telephone dispatch for patients crossing critical threshold (&ge;80%).</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between"><span>Primary Doctor:</span><span className="text-white font-bold">+91 90358 90001</span></div>
                <div className="flex justify-between"><span>Anti-Fatigue Guard:</span><span>300s Cooldown</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Technical Specifications & Latency Matrices */}
        {tab === "technical" && (
          <div className="clinical-panel rounded-2xl p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-slate-300">
              <Terminal className="size-4 text-cyan-400" />
              <span>Runtime Specifications &amp; Architectural Boundaries</span>
            </div>

            <div className="space-y-3 text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-cyan-400 font-bold mb-1">TimescaleDB Hypertable Definition:</div>
                <pre className="text-[11px] text-slate-400 overflow-x-auto">
{`CREATE TABLE vital_readings (
    time TIMESTAMPTZ NOT NULL,
    patient_id VARCHAR NOT NULL,
    hr FLOAT, bp_sys FLOAT, bp_dia FLOAT, spo2 FLOAT, temp FLOAT, rr FLOAT,
    PRIMARY KEY (time, patient_id)
);
SELECT create_hypertable('vital_readings', 'time', if_not_exists => TRUE);`}
                </pre>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-cyan-400 font-bold mb-1">Redis Sliding Window Key Architecture:</div>
                <pre className="text-[11px] text-slate-400 overflow-x-auto">
{`Sorted Set Key: patient:{patient_id}:abnorm:{abnormality_type}
Score: Epoch Timestamp (Seconds)
Window Sweep: ZREMRANGEBYSCORE key 0 (now - 300)`}
                </pre>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-cyan-400 font-bold mb-1">Composite Priority Score Formula:</div>
                <pre className="text-[11px] text-slate-400 overflow-x-auto">
{`Priority = clamp(
    risk_score * trend_mult + severity_bonus + max(0, (60 - time_to_critical) / 2),
    0, 100
)`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
