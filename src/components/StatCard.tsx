import { type ReactNode } from "react";

export function StatCard({
  label, value, sub, icon, accent = "cyan",
}: {
  label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode;
  accent?: "cyan" | "rose" | "amber" | "emerald";
}) {
  const accents: Record<string, string> = {
    cyan: "from-sky-400/30 to-cyan-300/10 text-cyan-200 border-cyan-400/30",
    rose: "from-rose-500/30 to-rose-400/10 text-rose-200 border-rose-400/30",
    amber: "from-amber-500/30 to-amber-300/10 text-amber-200 border-amber-400/30",
    emerald: "from-emerald-500/30 to-emerald-300/10 text-emerald-200 border-emerald-400/30",
  };
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 flex items-center gap-4">
      <div className={`size-12 rounded-xl grid place-items-center bg-gradient-to-br ${accents[accent]} border`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-2xl sm:text-3xl font-bold text-white leading-tight tabular-nums">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
