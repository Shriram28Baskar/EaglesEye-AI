import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutDashboard, Radar, BarChart3, Stethoscope } from "lucide-react";
import { type ReactNode } from "react";
import { useRealtime, usePatients } from "@/lib/store";
import { AlertsPanel } from "./AlertsPanel";


const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mission-control", label: "Mission Control", icon: Radar },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  useRealtime(3500);
  const patients = usePatients();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const critical = patients.filter(p => p.status === "Critical").length;
  const alerts = patients.filter(p => p.alert).length;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col glass-strong border-r border-white/10 p-5 gap-2 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl grid place-items-center bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-900 glow-cyan">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-base leading-tight">EaglesEye</div>
            <div className="text-[11px] text-cyan-300/80 uppercase tracking-widest">AI · v1.0</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(n => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition",
                  active
                    ? "bg-gradient-to-r from-sky-500/20 to-cyan-400/10 text-white border border-cyan-400/30"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto glass rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="text-emerald-300 font-medium">Live Telemetry</span>
          </div>
          <div className="flex justify-between text-slate-400"><span>Patients</span><span className="text-white">{patients.length}</span></div>
          <div className="flex justify-between text-slate-400"><span>Critical</span><span className="text-rose-300">{critical}</span></div>
          <div className="flex justify-between text-slate-400"><span>Active Alerts</span><span className="text-amber-300">{alerts}</span></div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass-strong border-b border-white/10 px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="lg:hidden flex items-center gap-2">
            <div className="size-8 rounded-lg grid place-items-center bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-900">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-bold">EaglesEye AI</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Activity className="size-4 text-cyan-300" />
            <span>Hospital Attention &amp; Response Intelligence</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
              <span className="live-dot" /> <span className="text-emerald-300">LIVE</span>
            </span>
            <AlertsPanel />
            <span className="hidden sm:inline text-slate-400">St. Aurora General Hospital</span>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="lg:hidden flex gap-1 px-3 py-2 overflow-x-auto glass-strong border-b border-white/10">
          {nav.map(n => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap",
                active ? "bg-cyan-400/15 text-white border border-cyan-400/30" : "text-slate-300 bg-white/5",
              ].join(" ")}>
                <Icon className="size-3.5" /> {n.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 sm:p-6 anim-slide-up">{children}</main>
      </div>
    </div>
  );
}
