import { useEffect, useMemo } from "react";
import { playSold } from "../sound.js";
import TeamBadge from "./TeamBadge.jsx";
import { TEAM_BY_CODE } from "../data/teams.js";

const fmt = (u) => (u / 100).toFixed(2) + " Cr";
const CONFETTI = ["#facc15", "#f472b6", "#38bdf8", "#4ade80", "#fb923c", "#c084fc", "#ffffff"];

// The SOLD moment: a stamp slams in, the buying team's crest pops in, and confetti falls.
export default function SoldFlash({ ev }) {
  const team = TEAM_BY_CODE[ev.teamId];
  // Play the sold sound once, when this sale appears.
  useEffect(() => { playSold(); }, [ev]);
  const color = team?.color ?? "#facc15";
  const pieces = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 1.2,
      size: 6 + Math.random() * 6,
      color: CONFETTI[i % CONFETTI.length],
    })),
    [ev]
  );

  return (
    <div className="flash sold-fx" role="status" aria-live="polite">
      {pieces.map((p) => (
        <i
          key={p.key}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div className="sold-stamp">SOLD</div>
      <div className="sold-badge" style={{ filter: `drop-shadow(0 0 14px ${color})` }}>
        <TeamBadge code={ev.teamId} color={color} owned />
      </div>
      <div className="sold-name">{ev.name}</div>
      <div className="sold-price">to <b>{ev.teamId}</b> for <b className="sold-amount">{fmt(ev.price)}</b></div>
    </div>
  );
}
