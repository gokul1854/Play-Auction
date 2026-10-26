import { useEffect, useRef, useState } from "react";
import { playCountdown } from "../sound.js";
import { CATEGORY_COLOR } from "./PlayerList.jsx";
import { StatLine, IplLine, FormatLines } from "./CardStats.jsx";

const fmt = (u) => (u / 100).toFixed(2) + " Cr";

export default function LotCard({ lot, windowMs, deadline, now, currentBid, leaderName, nextBid, purse, reason, onBid, onOpenStats, paused, pausedLeft, upcoming }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (paused) { setLeft(pausedLeft ?? 0); return; }
    if (deadline == null) return;
    const update = () => setLeft(Math.max(0, deadline - now()));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [deadline, now, paused, pausedLeft]);

  const pct = Math.min(100, (left / windowMs) * 100);
  const secs = Math.ceil(left / 1000);
  const lastSecs = useRef(null);

  // One sound per second in the last ten seconds, and a beep for the last three.
  useEffect(() => {
    if (paused || deadline == null) return;
    if (lastSecs.current === secs) return;
    lastSecs.current = secs;
    if (secs >= 1 && secs <= 10) playCountdown(secs <= 3 ? "beep" : "tick");
  }, [secs, paused, deadline]);
  const color = CATEGORY_COLOR[lot.category] ?? "#9a9aa5";
  const hasBid = currentBid != null;

  return (
    <div className="card lot">
      {paused && <span className="paused-tag">PAUSED</span>}
      <div className="lot-progress"><i className={left < 1500 ? "low" : ""} style={{ width: `${pct}%` }} /></div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
            <span className="badge" style={{ color, borderColor: color, background: `${color}22` }}>{lot.category}</span>
            <span className="badge plain">{lot.role}</span>
            {lot.country !== "India" && <span className="os-tag big">✈ OVERSEAS</span>}
          </div>
          <div className="lot-name" style={{ color }}>{lot.name}</div>
          <div className="muted">{lot.country}</div>
          <StatLine player={lot} />
          <IplLine player={lot} />
          <FormatLines player={lot} />
        </div>
        <div className="timer-box"><b>{Math.ceil(left / 1000)}</b><span>SEC</span></div>
      </div>


      <div className="price-row">
        <div className="price-box">
          <span className="price-label">Base price</span>
          <span className="price-val base">{fmt(lot.basePrice)}</span>
        </div>
        <div className={`price-box cur${hasBid ? " live" : ""}`}>
          <span className="price-label">Current bid{leaderName ? ` · ${leaderName}` : ""}</span>
          {/* key changes on every bid, which replays the flash animation */}
          <span key={currentBid ?? "none"} className="price-val bump">{hasBid ? fmt(currentBid) : "No bids"}</span>
        </div>
      </div>

      <div className="bidrow">
        <div className="purse">
          <span className="price-label">Purse</span>
          <b>{purse != null ? fmt(purse) : "—"}</b>
        </div>
        <button type="button" className="bid-btn" disabled={!!reason} onClick={() => onBid(nextBid)}>
          {reason ?? `BID ${fmt(nextBid)}`}
        </button>
      </div>
      {reason && reason !== "You hold the highest bid" && <p className="warn">{reason}</p>}
    </div>
  );
}
