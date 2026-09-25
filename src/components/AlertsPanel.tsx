import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle, Bell, X, CheckCheck, PhoneCall, ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { api, createAlertsWebSocket, type AlertEvent } from "@/lib/api";

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-rose-300 border-rose-400/40 bg-rose-500/10",
  high: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  moderate: "text-yellow-300 border-yellow-400/40 bg-yellow-500/10",
  low: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
};

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error("Failed to load alerts:", e);
    }
  }, []);

  useEffect(() => {
    load();
    const ws = createAlertsWebSocket((msg: any) => {
      if (msg?.alerts) {
        setAlerts(msg.alerts);
      } else {
        load();
      }
    });
    const interval = setInterval(load, 8000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [load]);

  const activeAlerts = alerts.filter(a => a.status === "generated" || a.status === "acknowledged" || a.status === "escalated");
  const unread = Math.max(0, activeAlerts.length - seenCount);

  useEffect(() => {
    if (open) setSeenCount(activeAlerts.length);
  }, [open, activeAlerts.length]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(id);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.resolveAlert(id);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscalate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.escalateAlert(id);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full glass hover:bg-white/10 transition"
        title="Live Clinical Alerts"
      >
        <Bell className="size-3.5 text-cyan-300" />
        <span className="text-cyan-300 hidden sm:inline">Alerts</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(420px,94vw)] max-h-[75vh] overflow-hidden rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <ShieldAlert className="size-4 text-rose-400" />
            <div className="font-semibold text-sm">Active Clinical Alerts</div>
            <div className="ml-auto text-[10px] text-slate-400">{activeAlerts.length} active</div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white ml-2"><X className="size-3.5" /></button>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-white/5 p-2 space-y-2">
            {activeAlerts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCheck className="size-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                No active clinical alerts. All wards within normal parameters.
              </div>
            )}
            {activeAlerts.map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 space-y-2 transition">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${SEVERITY_COLORS[a.severity] ?? ""}`}>
                    {a.severity}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300">
                    {a.alert_type === "correlated" ? "🔗 Correlated" : "Single Vital"}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-auto">{timeAgo(a.created_at)}</span>
                </div>

                <div className="font-medium text-xs text-white">
                  {a.abnormality_type} · Patient {a.patient_id}
                </div>
                <div className="text-[11px] text-slate-300 leading-snug">
                  {a.message}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {a.status === "generated" && (
                    <button
                      onClick={(e) => handleAcknowledge(a.id, e)}
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-medium text-slate-200 transition"
                    >
                      Acknowledge
                    </button>
                  )}
                  {a.status !== "resolved" && (
                    <button
                      onClick={(e) => handleResolve(a.id, e)}
                      className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-medium transition"
                    >
                      Resolve
                    </button>
                  )}
                  {a.status !== "escalated" && (
                    <button
                      onClick={(e) => handleEscalate(a.id, e)}
                      className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      <PhoneCall className="size-3" /> Escalate (Call)
                    </button>
                  )}
                  <Link
                    to="/patients/$id"
                    params={{ id: a.patient_id }}
                    onClick={() => setOpen(false)}
                    className="ml-auto text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                  >
                    View <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-white/10 bg-slate-900/50 text-center">
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-cyan-300 hover:underline font-medium inline-flex items-center gap-1"
            >
              Open Full Alert Center <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
