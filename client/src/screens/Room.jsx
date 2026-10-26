import { useState } from "react";
import { useRoom } from "../hooks/useRoom.js";
import { send, getName, setName, playerId } from "../socket.js";
import RoomLobby from "./RoomLobby.jsx";
import Auction from "./Auction.jsx";

// Decides what a room URL shows: a name prompt, the lobby, or the live auction.
export default function Room({ code, navigate }) {
  const { state, connected, now, kicked } = useRoom(code);
  const [name, setNameState] = useState(getName());
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const isMember = !!state?.members?.some((m) => m.id === playerId);

  async function join(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Enter your name");
    setJoining(true);
    setName(n);
    const r = await send("room:join", { code, name: n });
    setJoining(false);
    if (!r.ok) setError(r.error);
  }

  const frame = (children) => (
    <div className="wrap">
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn ghost small" onClick={() => navigate("/")}>← Home</button>
        <div>Room <span className="code">{code}</span></div>
      </div>
      {!connected && <div className="card warn">Reconnecting…</div>}
      {children}
    </div>
  );

  if (kicked) {
    return frame(<div className="card"><p className="label">Removed</p><p className="muted">The host removed you from this room.</p></div>);
  }

  if (!state || !isMember) {
    if (!connected && !state) return frame(<p className="muted">Connecting…</p>);
    return frame(
      <form onSubmit={join} className="card">
        <p className="label">Your name</p>
        <input value={name} maxLength={16} onChange={(e) => setNameState(e.target.value)} />
        <button className="btn" style={{ marginTop: 12 }} disabled={joining}>{joining ? "Joining…" : "Join room"}</button>
        {error && <p className="warn" style={{ marginTop: 10 }}>{error}</p>}
      </form>
    );
  }

  return frame(
    state.status === "lobby"
      ? <RoomLobby state={state} myId={playerId} navigate={navigate} />
      : <Auction state={state} myId={playerId} now={now} navigate={navigate} />
  );
}
