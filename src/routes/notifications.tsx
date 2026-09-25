import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, RefreshCw, AlertCircle, PhoneCall, Sparkles, Filter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notification Center · EaglesEye AI" }] }),
  component: NotificationsPage,
});

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 6000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "critical") return n.priority === "critical";
    if (filter === "escalation") return n.notification_type === "escalation";
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notification Center</h1>
            <p className="text-sm text-slate-400 mt-1">
              Dispatch log of telephone escalations, critical syndromic alarms, and AI triage completions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-xl glass hover:bg-white/10 text-xs font-semibold text-cyan-300 transition flex items-center gap-1.5"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={loadNotifications}
              className="p-2 rounded-xl glass hover:bg-white/10 transition text-slate-300"
              title="Refresh"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="glass rounded-2xl p-4 flex items-center gap-2">
          <Filter className="size-4 text-slate-400 mr-2" />
          {[
            { id: "all", label: "All" },
            { id: "unread", label: `Unread (${unreadCount})` },
            { id: "critical", label: "Critical Priority" },
            { id: "escalation", label: "Voice Calls" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.id ? "bg-cyan-500/20 text-white border border-cyan-400" : "text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <CheckCheck className="size-8 text-emerald-400 mx-auto opacity-75" />
              <div className="font-semibold text-white">No notifications matching filter</div>
              <p className="text-xs">You're all caught up.</p>
            </div>
          ) : (
            filtered.map(n => (
              <div
                key={n.id}
                className={`glass rounded-2xl p-4 sm:p-5 flex items-start gap-4 border transition ${
                  !n.read ? "border-cyan-400/30 bg-cyan-500/[0.02]" : "border-white/5 opacity-80"
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  n.notification_type === "escalation"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-400/30"
                    : n.priority === "critical"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                }`}>
                  {n.notification_type === "escalation" ? (
                    <PhoneCall className="size-5" />
                  ) : n.priority === "critical" ? (
                    <AlertCircle className="size-5" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">{n.title}</span>
                    {!n.read && (
                      <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {new Date(n.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.body}</p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                    title="Mark as read"
                  >
                    <CheckCheck className="size-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
