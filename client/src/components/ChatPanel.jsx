import { useState } from "react";
import { send } from "../socket.js";

// Colour for a system message, so joins, picks, sales and settings are easy to scan.
function systemColour(text) {
  if (/unsold/i.test(text)) return "#f87171";
  if (/sold to/i.test(text)) return "#4ade80";
  if (/joined/i.test(text)) return "#4ade80";
  if (/selected|released/i.test(text)) return "#fb923c";
  if (/timer|settings|mode/i.test(text)) return "#c084fc";
  if (/started|finished|ended|Simulated/i.test(text)) return "#facc15";
  return "#8d8d9a";
}

// Chat plus system messages (joins, team picks, sales). The server rate-limits sends.
export default function ChatPanel({ state, myId }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    const r = await send("chat:send", { text });
    if (r.ok) setText("");
    else setErr(r.error);
  }

  const mine = (m) => m.from === myId;
  return (
    <div className="chatbox">
      <div className="cb-head">
        <span className="cb-live" aria-hidden="true" />
        <span className="cb-title">Room chat</span>
        <span className="cb-count">{state.members.length} in room</span>
      </div>
      <div className="cb-feed">
        {state.chat.slice(-60).map((m, i) =>
          m.type === "system" ? (
            <div key={i} className="cb-sys"><span style={{ color: systemColour(m.text), borderColor: systemColour(m.text) + "55" }}>{m.text}</span></div>
          ) : (
            <div key={i} className={`cb-row${mine(m) ? " me" : ""}`}>
              {!mine(m) && <span className="cb-name">{m.name}</span>}
              <div className={`cb-bubble${mine(m) ? " me" : ""}`}>{m.text}</div>
            </div>
          )
        )}
      </div>
      <form onSubmit={submit} className="cb-form">
        <input value={text} maxLength={300} placeholder="Say something…" onChange={(e) => { setText(e.target.value); setErr(""); }} />
        <button type="button" className="cb-send" disabled={!text.trim()} onClick={submit} aria-label="Send">Send</button>
      </form>
      {err && <p className="warn" style={{ margin: "6px 4px 0" }}>{err}</p>}
    </div>
  );
}
