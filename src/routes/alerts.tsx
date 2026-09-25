import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, AlertTriangle, CheckCircle, PhoneCall, RefreshCw,
  Filter, ArrowRight, CheckCheck, Eye, Layers, Clock, Zap
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, createAlertsWebSocket, type AlertEvent } from "@/lib/api";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Clinical Alert Management · EaglesEye AI" }] }),
  component: AlertsPage,
});

const SEVERITY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40" },
  high:     { label: "High Risk", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40" },
  moderate: { label: "Monitor",   bg: "bg-sky-500/15",   text: "text-sky-400",   border: "border-sky-500/40" },
  low:      { label: "Stable",    bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40" },
};

const LIFECYCLE_STEPS = ["generated", "acknowledged", "viewed", "resolved", "escalated"];

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"action_required" | "acknowledged" | "resolved">("action_required");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const ws = createAlertsWebSocket((msg: any) => {
      if (msg?.alerts) setAlerts(msg.alerts);
      else loadAlerts();
    });
    const interval = setInterval(loadAlerts, 8000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeAlert(id);
      await loadAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.resolveAlert(id);
      await loadAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await api.escalateAlert(id);
      await loadAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter into Action Required (generated/escalated) vs Acknowledged vs Resolved
  const actionRequiredAlerts = alerts.filter(a => a.status === "generated" || a.status === "escalated");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged" || a.status === "viewed");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");

  const currentList = activeTab === "action_required"
    ? actionRequiredAlerts
    : activeTab === "acknowledged"
    ? acknowledgedAlerts
    : resolvedAlerts;

  const filtered = currentList.filter(a => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (typeFilter !== "all" && a.alert_type !== typeFilter) return false;
    return true;
  });

  const criticalCount = actionRequiredAlerts.filter(a => a.severity === "critical").length;
  const correlatedCount = alerts.filter(a => a.alert_type === "correlated").length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded inline-block">
              Clinical Alert Management Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Correlated Syndromes &amp; Alarm Escalation
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-parameter sliding-window correlation eliminates alarm fatigue by consolidating co-occurring abnormalities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAlerts}
              className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-white/10 transition text-slate-300"
              title="Refresh alerts"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Alarm Acuity Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="clinical-panel rounded-xl p-4 border border-rose-500/40 bg-rose-950/15">
            <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="size-3.5" /> Action Required (Critical)
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tabular-nums">
              {criticalCount}
            </div>
            <div className="text-[10px] text-rose-200/70 mt-0.5">Immediate intervention protocol</div>
          </div>

          <div className="clinical-panel rounded-xl p-4">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="size-3.5" /> Pending Acknowledgment
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tabular-nums">
              {actionRequiredAlerts.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Unreviewed by assigned nurse</div>
          </div>

          <div className="clinical-panel rounded-xl p-4">
            <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5" /> Correlated Syndromes
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tabular-nums">
              {correlatedCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">De-duplicated multi-vital alarms</div>
          </div>

          <div className="clinical-panel rounded-xl p-4">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCheck className="size-3.5" /> Resolved Cases
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tabular-nums">
              {resolvedAlerts.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Audited &amp; closed</div>
          </div>
        </div>

        {/* Action-Oriented Tab Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("action_required")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "action_required"
                  ? "border-rose-500 text-rose-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              Action Required ({actionRequiredAlerts.length})
            </button>

            <button
              onClick={() => setActiveTab("acknowledged")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "acknowledged"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="size-3.5" />
              In Progress ({acknowledgedAlerts.length})
            </button>

            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "resolved"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <CheckCheck className="size-3.5" />
              Resolved ({resolvedAlerts.length})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="size-3.5 text-slate-500" />
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-slate-300 text-xs"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-slate-300 text-xs"
            >
              <option value="all">All Types</option>
              <option value="correlated">Correlated Patterns</option>
              <option value="single_vital">Single Vital Alarms</option>
            </select>
          </div>
        </div>

        {/* Alert Cards List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="clinical-panel rounded-2xl p-12 text-center text-slate-500 space-y-2">
              <CheckCircle className="size-8 text-emerald-400 mx-auto opacity-70" />
              <div className="font-bold text-white text-sm">No Active Alarms in this Queue</div>
              <p className="text-xs text-slate-400">All alerts under this category have been acknowledged or resolved.</p>
            </div>
          ) : (
            filtered.map(a => {
              const badge = SEVERITY_BADGES[a.severity] || SEVERITY_BADGES.low;
              const isCritical = a.severity === "critical";

              return (
                <div
                  key={a.id}
                  className={`clinical-panel rounded-2xl p-5 border transition flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                    isCritical && a.status !== "resolved"
                      ? "border-rose-500/50 bg-rose-950/10 shadow-lg shadow-rose-950/20"
                      : "border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                      <span className="font-mono text-cyan-300 font-semibold text-[11px]">
                        {a.alert_type === "correlated" ? "🔗 CORRELATED SYNDROME" : "SINGLE VITAL ALARM"}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Patient {a.patient_id}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(a.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      {a.abnormality_type}
                    </h3>

                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      {a.message}
                    </p>

                    {/* Lifecycle Visual Track */}
                    <div className="pt-1 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <span>Lifecycle:</span>
                      {LIFECYCLE_STEPS.map((step, idx) => {
                        const isCurrent = a.status === step;
                        const isPassed = LIFECYCLE_STEPS.indexOf(a.status) >= idx;
                        return (
                          <span
                            key={step}
                            className={`px-1.5 py-0.5 rounded capitalize ${
                              isCurrent
                                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40"
                                : isPassed
                                ? "text-slate-400"
                                : "text-slate-700"
                            }`}
                          >
                            {step}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clinical Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {a.status === "generated" && (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs border border-white/10 transition"
                      >
                        Acknowledge
                      </button>
                    )}

                    {a.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(a.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold text-xs transition"
                      >
                        Mark Resolved
                      </button>
                    )}

                    {a.status !== "escalated" && (
                      <button
                        onClick={() => handleEscalate(a.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <PhoneCall className="size-3.5" /> Call On-Duty Doctor
                      </button>
                    )}

                    <Link
                      to="/patients/$id"
                      params={{ id: a.patient_id }}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-cyan-300 hover:bg-white/10 transition"
                      title="Inspect Patient"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
