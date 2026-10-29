import { useId } from "react";

// Персонаж помічника: маленький робот з екраном-обличчям. Стан: idle | listening | thinking.
export default function Bot({ size = 64, state = "idle", className = "" }: { size?: number; state?: "idle" | "listening" | "thinking" | "speaking"; className?: string }) {
  // Свої id градієнтів: прихована копія (напр. кнопка в нижньому меню на компʼютері) не має ламати видиму
  const u = useId().replace(/:/g, "");
  const head = `bh${u}`, body = `bb${u}`, glow = `bg${u}`;
  return (
    <svg className={`bot bot-${state} ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={head} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f5ff" />
          <stop offset="1" stopColor="#b4c3f2" />
        </linearGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b82ff" />
          <stop offset="1" stopColor="#2a4bd1" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#8fe9ff" />
          <stop offset="1" stopColor="#8fe9ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="bot-float">
        {/* антена */}
        <line x1="32" y1="8" x2="32" y2="15" stroke="#9fb2ec" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="bot-light-glow" cx="32" cy="6.5" r="6" fill={`url(#${glow})`} />
        <circle className="bot-light" cx="32" cy="6.5" r="3" fill="#7fe3ff" />
        {/* вушка */}
        <rect x="7.5" y="24" width="5" height="11" rx="2.5" fill={`url(#${body})`} />
        <rect x="51.5" y="24" width="5" height="11" rx="2.5" fill={`url(#${body})`} />
        {/* голова */}
        <rect x="11" y="14" width="42" height="31" rx="13" fill={`url(#${head})`} />
        {/* екран-обличчя */}
        <rect x="16" y="19.5" width="32" height="20" rx="9" fill="#0a1131" />
        <g className="bot-eyes">
          <rect className="bot-eye" x="22.5" y="25" width="6" height="8" rx="3" fill="#6fe3ff" />
          <rect className="bot-eye" x="35.5" y="25" width="6" height="8" rx="3" fill="#6fe3ff" />
        </g>
        <path className="bot-mouth" d="M29 35.2 q3 2.2 6 0" fill="none" stroke="#6fe3ff" strokeWidth="1.6" strokeLinecap="round" />
        <circle className="bot-mouth-o" cx="32" cy="35.6" r="1.6" fill="#6fe3ff" />
        {/* тільце */}
        <rect x="20" y="46" width="24" height="13" rx="6.5" fill={`url(#${body})`} />
        <circle className="bot-heart" cx="32" cy="52.5" r="2.4" fill="#9ff0ff" />
      </g>
    </svg>
  );
}
