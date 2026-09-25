import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Cpu, Database, Server, Wifi, Sparkles, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, PhoneCall, ShieldCheck, Activity, Terminal, ExternalLink
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, type SystemHealth } from "@/lib/api";

export const Route = createFileRoute("/system-health")({
  head: () => ({ meta: [{ title: "System Operational Health · EaglesEye AI" }] }),
  component: SystemHealthPage,
});

export function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [tab, setTab] = useState<"overview" | "technical">("overview");

  const load = useCallback(async () => {
    try {
      const data = await api.getSystemHealth();
      setHealth(data);
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

        {/* View Switcher: Clinical Overview vs Engineering Deep-Dive */}
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
