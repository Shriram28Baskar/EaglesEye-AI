import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Activity, LayoutDashboard, Radar, BarChart3, Stethoscope,
  Bell, Cpu, PlayCircle, Users2, Search, X, ArrowRight, ShieldAlert,
  Wifi, HeartPulse
} from "lucide-react";
import { type ReactNode, useState, useEffect, useRef } from "react";
import { AlertsPanel } from "./AlertsPanel";
import { api, type DashboardSummary, type PatientSummary } from "@/lib/api";

const nav = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/alerts", label: "Alert Center", icon: Bell },
  { to: "/simulator", label: "Clinical Simulator", icon: PlayCircle },
  { to: "/system-health", label: "System Health", icon: Cpu },
  { to: "/compare", label: "Patient Compare", icon: Users2 },
  { to: "/notifications", label: "Notification Log", icon: Activity },
  { to: "/analytics", label: "Ward Analytics", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ patients: PatientSummary[]; alerts: any[] }>({ patients: [], alerts: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Poll real dashboard summary for sidebar telemetry counters
  useEffect(() => {
    const loadSummary = () => {
      api.getDashboardSummary().then(setSummary).catch(() => {});
    };
    loadSummary();
    const interval = setInterval(loadSummary, 8000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Cmd/Ctrl+K search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Handle live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ patients: [], alerts: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.search(searchQuery.trim());
        setSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  return (
    <div className="min-h-screen flex bg-[#070a12] text-slate-100">
      {/* Clinical Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#0b1120] border-r border-white/[0.08] p-4 gap-2 sticky top-0 h-screen">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3 mb-2 border-b border-white/[0.06]">
          <div className="size-9 rounded-xl grid place-items-center bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-base leading-tight text-white flex items-center gap-1.5">
              EaglesEye <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950 px-1 rounded">AI</span>
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Clinical Command
            </div>
          </div>
        </div>

        {/* Global Search Shortcut trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:border-cyan-400/40 transition mb-2"
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5 text-slate-500" />
            <span>Search clinical index...</span>
          </span>
          <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300">⌘K</kbd>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {nav.map(n => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-sm"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-cyan-400" : "text-slate-500"}`} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Hospital Live Status Card */}
        <div className="mt-auto rounded-xl p-3.5 bg-slate-950/90 border border-white/[0.07] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <span className="live-dot" /> Hospital Telemetry
            </span>
            <Link to="/system-health" className="text-[10px] text-cyan-400 hover:underline">
              Inspect
            </Link>
          </div>

          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>Active Patients</span>
            <span className="font-mono font-bold text-white">{summary?.total_patients ?? 20}</span>
          </div>

          <div className="flex justify-between text-slate-400 text-[11px]">
            <span className="text-rose-400 font-medium">Critical Acuity</span>
            <span className="font-mono font-bold text-rose-300">{summary?.critical_count ?? 0}</span>
          </div>

          <div className="flex justify-between text-slate-400 text-[11px]">
            <span className="text-amber-400 font-medium">Active Alarms</span>
            <span className="font-mono font-bold text-amber-300">{summary?.active_alerts ?? 0}</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#090e1b]/95 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-2">
              <div className="size-7 rounded-lg grid place-items-center bg-cyan-500 text-slate-950">
                <Stethoscope className="size-4" />
              </div>
              <span className="font-extrabold text-sm text-white">EaglesEye AI</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="text-slate-200 font-medium">St. Aurora General</span>
              <span>·</span>
              <span className="text-slate-400">ICU &amp; General Inpatient Telemetry Corridor</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white text-xs"
            >
              <Search className="size-3 text-slate-500" />
              <span>Search (⌘K)</span>
            </button>

            <Link
              to="/system-health"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300 hover:text-white"
            >
              <span className="live-dot" />
              <span className="text-[11px] font-semibold text-emerald-400">SYSTEM HEALTHY</span>
            </Link>

            <AlertsPanel />
          </div>
        </header>

        {/* Mobile Navigation Strip */}
        <nav className="lg:hidden flex gap-1 px-3 py-2 overflow-x-auto bg-[#0b1120] border-b border-white/10">
          {nav.map(n => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
                  active
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                    : "text-slate-400 bg-slate-900"
                }`}
              >
                <Icon className="size-3" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* QUICK COMMAND SEARCH MODAL (Cmd/Ctrl + K) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-start justify-center pt-20 p-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="clinical-panel rounded-2xl max-w-xl w-full border border-cyan-400/30 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b border-white/10 flex items-center gap-2.5 bg-slate-950">
              <Search className="size-4 text-cyan-400 shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient name, ID (e.g. P01), diagnosis, or alarm..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/5 text-xs">
              {searchLoading ? (
                <div className="py-8 text-center text-slate-400">Searching clinical index...</div>
              ) : searchQuery && searchResults.patients.length === 0 && searchResults.alerts.length === 0 ? (
                <div className="py-8 text-center text-slate-500">No matching patient or alarm records.</div>
              ) : !searchQuery ? (
                <div className="p-4 text-slate-500 text-xs">
                  Type a patient ID (e.g., <code className="text-cyan-300">P01</code>, <code className="text-cyan-300">P04</code>), diagnosis (e.g. <code className="text-cyan-300">Sepsis</code>), or room number.
                </div>
              ) : (
                <>
                  {searchResults.patients.map((p: any) => (
                    <Link
                      key={p.id}
                      to="/patients/$id"
                      params={{ id: p.id }}
                      onClick={() => setSearchOpen(false)}
                      className="p-2.5 rounded-lg hover:bg-white/5 flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-white group-hover:text-cyan-300 flex items-center gap-2">
                          <span className="font-mono text-cyan-400">{p.id}</span>
                          <span>{p.name}</span>
                          <span className="text-[10px] text-slate-400">({p.age}{p.gender})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.ward} · Room {p.room} · <strong className="text-slate-300">{p.diagnosis}</strong>
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-slate-500 group-hover:text-cyan-300" />
                    </Link>
                  ))}

                  {searchResults.alerts.map((a: any) => (
                    <Link
                      key={a.id}
                      to="/alerts"
                      onClick={() => setSearchOpen(false)}
                      className="p-2.5 rounded-lg hover:bg-white/5 flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                          <ShieldAlert className="size-3 text-rose-400" />
                          <span>{a.abnormality_type}</span>
                          <span className="text-[10px] text-slate-500">· Patient {a.patient_id}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-sm">{a.message}</div>
                      </div>
                      <ArrowRight className="size-4 text-slate-500" />
                    </Link>
                  ))}
                </>
              )}
            </div>

            <div className="p-2 bg-slate-950 text-[10px] text-slate-500 border-t border-white/5 flex justify-between">
              <span>Press <kbd className="bg-white/10 px-1 rounded text-slate-300">ESC</kbd> to close</span>
              <span>FastAPI Full-Text Index (&lt;300ms)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
