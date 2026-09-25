export function RiskRing({ score, size = 56 }: { score: number; size?: number }) {
  const displayScore = Math.round(Number(score) || 0);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clampedScore = Math.min(100, Math.max(0, displayScore));
  const offset = c - (clampedScore / 100) * c;
  const color =
    displayScore >= 80 ? "#f43f5e" :
    displayScore >= 60 ? "#f59e0b" :
    displayScore >= 35 ? "#38bdf8" :
    "#10b981";

  const fontSize = size >= 64 ? "text-base font-bold" : size >= 48 ? "text-xs font-bold" : "text-[11px] font-bold";

  return (
    <div className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s" }}
        />
      </svg>
      <div className={`absolute inset-0 grid place-items-center tabular-nums leading-none ${fontSize}`} style={{ color }}>
        {displayScore}
      </div>
    </div>
  );
}
