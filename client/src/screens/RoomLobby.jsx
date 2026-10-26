import { useState } from "react";
import { send } from "../socket.js";
import TeamPicker from "../components/TeamPicker.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import StartModal from "../components/StartModal.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import { TEAM_BY_CODE, teamsForSet } from "../data/teams.js";
import { MODES, BID_TIMERS, SPEEDS } from "../data/modes.js";

export default function RoomLobby({ state, myId, navigate }) {
  const [tab, setTab] = useState("members");
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState("");
  const isHost = state.hostId === myId;
  const joinUrl = `${window.location.origin}/room/${state.code}`;
  const myTeam = Object.keys(state.claims).find((t) => state.claims[t] === myId) ?? null;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Join my auction: ${joinUrl}`)}`;

  async function pick(teamId) {
    const r = await send("team:claim", { teamId });
    if (!r.ok) setMsg(r.error);
  }

  async function start(force) {
    const r = await send("room:start", { force });
    if (r.needsConfirmation) return setModal({ joined: r.joined, total: r.total });
    setModal(null);
    if (!r.ok) setMsg(r.error);
  }

  async function setTimer(sec) {
    const r = await send("room:settings", { bidWindowMs: sec * 1000 });
    if (!r.ok) setMsg(r.error);
  }

  async function setOrder(order) {
    const r = await send("room:order", { order });
    if (!r.ok) setMsg(r.error);
  }

  async function setSpeed(speed) {
    const r = await send("room:speed", { speed });
    if (!r.ok) setMsg(r.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setMsg("Link copied");
    } catch {
      setMsg(joinUrl);
    }
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: "Join my auction", text: `Room ${state.code}`, url: joinUrl }).catch(() => {});
    } else {
      copy();
    }
  }

  async function leave() {
    await send("room:leave");
    navigate("/");
  }

  return (
    <div>
      <div className="topbar">
        <button type="button" className="iconbtn" onClick={() => navigate("/")} aria-label="Back">←</button>
        <span className="topbar-title">Room: <span className="code">{state.code}</span></span>
        {isHost
          ? <button type="button" className="btn small" onClick={() => start(false)}>▷ Start</button>
          : <span className="muted">Waiting</span>}
      </div>

      <div className="card">
        <p className="label">Invite Friends</p>
        <div className="invite">
          <code className="linkbox">{joinUrl}</code>
          <button type="button" className="iconbtn" onClick={copy} aria-label="Copy link">⧉</button>
          <a className="iconbtn green" href={whatsapp} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp">✆</a>
          <button type="button" className="btn small" onClick={share}>Share</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <p className="label" style={{ margin: 0 }}>Select Your Team</p>
          {myTeam && <span className="chip">{TEAM_BY_CODE[myTeam]?.name}</span>}
        </div>
        <TeamPicker claims={state.claims} members={state.members} myId={myId} onPick={pick} teams={teamsForSet(state.settings?.teamSet)} />
      </div>

      <div className="tabs">
        <button type="button" className={`tab-btn${tab === "members" ? " on" : ""}`} onClick={() => setTab("members")}>Members {state.members.length}/10</button>
        <button type="button" className={`tab-btn${tab === "chat" ? " on" : ""}`} onClick={() => setTab("chat")}>Chat</button>
        <button type="button" className={`tab-btn${tab === "settings" ? " on" : ""}`} onClick={() => setTab("settings")}>Settings</button>
      </div>

      {tab === "members" && (
        <div className="card">
          {state.members.map((m) => (
            <div key={m.id} className="prow" style={{ paddingLeft: 0 }}>
              <span>
                <span style={{ color: m.connected ? "var(--good)" : "var(--muted)" }}>●</span> {m.name}
                {m.id === state.hostId ? <span className="muted"> · host</span> : null}
              </span>
              <span className="member-end">
                <span className="muted">{Object.keys(state.claims).find((t) => state.claims[t] === m.id) ?? "no team"}</span>
                {state.hostId === myId && m.id !== state.hostId && (
                  <button type="button" className="x-kick" aria-label={`Remove ${m.name}`} title="Remove from room" onClick={() => send("room:kick", { playerId: m.id })}>✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "chat" && <ChatPanel state={state} myId={myId} />}

      {tab === "settings" && <SettingsPanel state={state} isHost={isHost} onLeave={leave} />}

      {msg && <p className="muted" style={{ textAlign: "center" }}>{msg}</p>}
      {modal && (
        <StartModal joined={modal.joined} total={modal.total} onStart={() => start(true)} onWait={() => setModal(null)} />
      )}
    </div>
  );
}
