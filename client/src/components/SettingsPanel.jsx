import { useState } from "react";
import { send } from "../socket.js";
import { MODES, BID_TIMERS, SPEEDS } from "../data/modes.js";

// Room settings. Shown in the lobby and on the auction screen. Only the host can change them.
// Bid timer and speed can change during the auction and apply from the next lot.
// Set order and auction mode are locked once the auction starts.
export default function SettingsPanel({ state, isHost, onLeave }) {
  const [msg, setMsg] = useState("");
  const live = state.status === "live";
  const finished = state.status === "finished";
  const timingOpen = isHost && !finished;
  const orderOpen = isHost && state.status === "lobby";
  const speed = state.settings.speed ?? 1;
  const order = state.settings.lotOrder ?? "category";

  async function call(type, payload) {
    const r = await send(type, payload);
    setMsg(r.ok ? "" : r.error);
  }

  return (
    <div className="card">
      {live && <p className="info">The bid timer and speed apply from the next lot.</p>}

      <div className="setting">
        <div>
          <b>Bid Timer</b>
          <div className="muted" style={{ fontSize: 12 }}>Time allowed for each bid round</div>
        </div>
        <span className="setting-val">{state.settings.bidWindowMs / 1000}s</span>
      </div>
      <div className="timer-choices">
        {BID_TIMERS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={`timer-choice${state.settings.bidWindowMs === sec * 1000 ? " on" : ""}`}
            disabled={!timingOpen}
            onClick={() => call("room:settings", { bidWindowMs: sec * 1000 })}
          >
            {sec}s
          </button>
        ))}
      </div>

      <div className="setting">
        <div>
          <b>Auction Speed</b>
          <div className="muted" style={{ fontSize: 12 }}>Speeds up the bid timer. 10x makes a 10s timer last 1s.</div>
        </div>
        <span className="setting-val">{speed}x</span>
      </div>
      <div className="timer-choices speed-choices">
        {SPEEDS.map((x) => (
          <button
            key={x}
            type="button"
            className={`timer-choice${speed === x ? " on" : ""}`}
            disabled={!timingOpen}
            onClick={() => call("room:speed", { speed: x })}
          >
            {x}x
          </button>
        ))}
      </div>

      <div className="setting">
        <div>
          <b>Set Order</b>
          <div className="muted" style={{ fontSize: 12 }}>
            {orderOpen ? "By category, or all batters, keepers, all-rounders and bowlers in turn" : "Locked once the auction starts"}
          </div>
        </div>
        <span className="setting-val">{order === "role" ? "By role" : "By category"}</span>
      </div>
      <div className="timer-choices order-choices">
        {[["category", "By category"], ["role", "By role"]].map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={`timer-choice${order === v ? " on" : ""}`}
            disabled={!orderOpen}
            onClick={() => call("room:order", { order: v })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="setting">
        <div>
          <b>Auction Mode</b>
          <div className="muted" style={{ fontSize: 12 }}>Cannot be changed after room creation</div>
        </div>
        <span className="setting-val gold">{MODES.find((m) => m.id === state.settings.mode)?.label ?? state.settings.mode}</span>
      </div>

      <div className="setting">
        <div>
          <b>Overseas Limit</b>
          <div className="muted" style={{ fontSize: 12 }}>Most overseas players a squad may hold. Applies to the next bid.</div>
        </div>
        <span className="setting-val">{state.settings.overseasLimit == null ? "Off" : `${state.settings.overseasLimit} per squad`}</span>
      </div>
      <div className="timer-choices overseas-choices">
        {[[null, "Off"], [4, "4"], [6, "6"], [8, "8"]].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            className={`timer-choice${(state.settings.overseasLimit ?? null) === v ? " on" : ""}`}
            disabled={!timingOpen}
            onClick={() => call("room:overseas", { limit: v })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="setting">
        <b>Starting Purse</b>
        <span className="setting-val green">₹{state.settings.startingPurse / 100} Cr</span>
      </div>

      {isHost && (
        <div style={{ marginTop: 16 }}>
          <p className="label">Players</p>
          {state.members.filter((m) => m.id !== state.hostId).length === 0 && <p className="muted">No other players yet.</p>}
          {state.members.filter((m) => m.id !== state.hostId).map((m) => (
            <div key={m.id} className="prow" style={{ paddingLeft: 0 }}>
              <span>{m.name} <span className="muted">· {Object.keys(state.claims).find((t) => state.claims[t] === m.id) ?? "no team"}</span></span>
              <button type="button" className="btn small kick" onClick={() => call("room:kick", { playerId: m.id })}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {!isHost && <p className="muted" style={{ marginTop: 12 }}>Only the host can change these settings.</p>}
      {msg && <p className="warn">{msg}</p>}
      {onLeave && <button type="button" className="btn ghost" style={{ marginTop: 16 }} onClick={onLeave}>Leave room</button>}
    </div>
  );
}
