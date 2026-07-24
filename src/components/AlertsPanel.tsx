import { useEffect, useRef, useState } from "react";
import { MessageCircle, Bell, X, Phone, ExternalLink, CheckCheck } from "lucide-react";
import { useAlerts, whatsappLink, type AlertLog } from "@/lib/store";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function AlertsPanel() {
  const alerts = useAlerts();
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(alerts.length);
  const ref = useRef<HTMLDivElement>(null);

  const unread = Math.max(0, alerts.length - seenCount);

  useEffect(() => {
    if (open) setSeenCount(alerts.length);
  }, [open, alerts.length]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full glass hover:bg-white/10 transition"
        title="WhatsApp Alerts Dispatched"
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
        <div className="absolute right-0 mt-2 w-[min(380px,90vw)] max-h-[70vh] overflow-hidden rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <MessageCircle className="size-4 text-emerald-300" />
            <div className="font-semibold text-sm">WhatsApp Dispatch Log</div>
            <div className="ml-auto text-[10px] text-slate-400">{alerts.length} sent</div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X className="size-3.5" /></button>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-white/5">
            {alerts.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                No alerts yet. Auto-dispatch triggers when a patient's risk crosses 60%.
              </div>
            )}
            {alerts.map(a => <AlertItem key={a.id} a={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertItem({ a }: { a: AlertLog }) {
  return (
    <div className="p-3 hover:bg-white/[0.03]">
      <div className="flex items-start gap-2">
        <div className="size-8 shrink-0 rounded-full bg-emerald-500/20 grid place-items-center mt-0.5">
          <MessageCircle className="size-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-white truncate">Nurse {a.nurse.name}</span>
            <span className="text-slate-500">·</span>
            <a href={`tel:+${a.nurse.phone}`} className="text-slate-400 hover:text-white transition-colors truncate flex items-center gap-1"><Phone className="size-3" />+{a.nurse.phone}</a>
            <span className="ml-auto text-[10px] text-slate-500 shrink-0">{timeAgo(a.ts)}</span>
          </div>
          <div className="text-xs text-slate-300 mt-1">
            <span className="text-rose-300 font-medium">{a.patientName}</span>
            <span className="text-slate-500"> · {a.patientId} · risk </span>
            <span className="text-amber-300 font-semibold">{a.risk}%</span>
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-300 bg-black/30 border border-white/5 rounded-lg p-2 max-h-32 overflow-y-auto font-sans">
{a.message}
          </pre>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-emerald-300 flex items-center gap-1">
              <CheckCheck className="size-3" /> Delivered via WhatsApp
            </span>
            <a
              href={whatsappLink(a.nurse.phone, a.message)}
              target="_blank" rel="noreferrer"
              className="text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1"
            >
              Open chat <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
