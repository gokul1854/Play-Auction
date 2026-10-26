import { useState } from "react";
import { send, getName, setName, socket, playerId } from "../socket.js";
import TeamPicker from "../components/TeamPicker.jsx";
import { MODES } from "../data/modes.js";
import { TEAM_BY_CODE, teamsForSet } from "../data/teams.js";

const ME = "me"; // placeholder id so the team picker can show one selected team before the room exists

export default function Home({ navigate }) {
  const [name, setNameState] = useState(getName());
  const [team, setTeam] = useState(null);
  const [visibility, setVisibility] = useState("public");
  const [mode, setMode] = useState("full");
  const [teamSet, setTeamSet] = useState("ipl");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function requireName() {
    const n = name.trim();
    if (!n) { setMsg("Enter your name first"); return null; }
    setName(n);
    return n;
  }

  async function create() {
    const n = requireName();
    if (!n) return;
    if (!team) return setMsg("Choose your team");
    setBusy(true);

    let stopWaiting;
    const roomFromState = new Promise((resolve) => {
      const finish = (code) => {
        clearTimeout(timeout);
        socket.off("room:state", onState);
        resolve(code);
      };
      const onState = (snapshot) => {
        if (snapshot?.hostId === playerId && snapshot.members?.some((member) => member.id === playerId)) {
          finish(snapshot.code);
        }
      };
      const timeout = setTimeout(() => finish(null), 5000);
      stopWaiting = () => finish(null);
      socket.on("room:state", onState);
    });

    const r = await send("room:create", { name: n, visibility, mode, teamSet });
    if (!r.ok) {
      stopWaiting();
      setBusy(false);
      return setMsg(r.error);
    }
    const responseCode = /^[A-Z0-9]{6}$/.test(r.roomCode ?? "") ? r.roomCode : null;
    const roomCode = responseCode ?? await roomFromState;
    if (responseCode) stopWaiting();
    if (!/^[A-Z0-9]{6}$/.test(roomCode ?? "")) {
      setBusy(false);
      return setMsg("Room was created, but no room code was received. Restart the server and try again.");
    }
    const c = await send("team:claim", { teamId: team });
    setBusy(false);
    if (!c.ok) return setMsg(`Room ${roomCode} was created, but your team could not be claimed: ${c.error}`);
    navigate(`/room/${roomCode}`);
  }

  async function join(code) {
    const n = requireName();
    if (!n) return;
    const c = (code ?? joinCode).trim().toUpperCase();
    if (!c) return setMsg("Enter a room code");
    setBusy(true);
    const r = await send("room:join", { code: c, name: n });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    navigate(`/room/${c}`);
  }

  return (
    <div className="wrap">
      <div className="hero">
        <div className="team-switch" role="group" aria-label="Team set" data-set={teamSet}>
          <span className="ts-glow" aria-hidden="true" />
          {[["ipl", "IPL franchises", "ts-ipl"], ["international", "National teams", "ts-nat"]].map(([v, label, cls]) => (
            <button key={v} type="button" className={`ts-opt ${cls}${teamSet === v ? " on" : ""}`} aria-pressed={teamSet === v} onClick={() => { setTeamSet(v); setTeam(null); }}>
              <span className="ts-mark" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <span className="hero-tag">IPL Auction Ready</span>
        <h1>Play IPL Auction <span>with Friends</span></h1>
      </div>

      <div className="feature-row">
        <div className="feature f-orange"><span>Player list · 207 players</span><span className="tag new">NEW</span></div>
        <div className="feature f-purple"><span>Match simulator</span><span className="tag live">LIVE</span></div>
      </div>

      <div className="card">
        <div className="seg">
          <button type="button" className="on">Cricket</button>
          <button type="button" disabled title="Coming soon">Football · soon</button>
        </div>

        <>
            <p className="label">Your name</p>
            <input value={name} maxLength={16} placeholder="e.g. Gokul" onChange={(e) => setNameState(e.target.value)} />

            <p className="label" style={{ marginTop: 16 }}>Choose your team</p>
            <TeamPicker claims={team ? { [team]: ME } : {}} members={[]} myId={ME} onPick={(code) => setTeam(code)} teams={teamsForSet(teamSet)} />
            {team && <p className="muted" style={{ textAlign: "center", marginTop: 10 }}>{TEAM_BY_CODE[team].city} · {TEAM_BY_CODE[team].name}{TEAM_BY_CODE[team].site && <> · <a href={TEAM_BY_CODE[team].site} target="_blank" rel="noopener noreferrer">official site</a></>}</p>}

            <p className="label" style={{ marginTop: 16 }}>Room type</p>
            <div className="choice-grid">
              <button type="button" className={`choice c-green${visibility === "public" ? " on" : ""}`} onClick={() => setVisibility("public")}>
                <b>Public</b><span>Anyone can find &amp; join</span>
              </button>
              <button type="button" className={`choice c-grey${visibility === "private" ? " on" : ""}`} onClick={() => setVisibility("private")}>
                <b>Private</b><span>Only people you invite</span>
              </button>
            </div>

            <p className="label" style={{ marginTop: 16 }}>Auction mode</p>
            <div className="mode-list">
              {MODES.map((m) => (
                <button key={m.id} type="button" className={`mode c-${m.id}${mode === m.id ? " on" : ""}`} onClick={() => setMode(m.id)}>
                  <b>{m.label}</b><span>{m.desc}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn" style={{ marginTop: 16 }} disabled={busy} onClick={create}>
              {busy ? "Creating…" : "Create Room"}
            </button>

            <p className="label" style={{ marginTop: 18 }}>Or join with a code</p>
            <form className="row" onSubmit={(e) => { e.preventDefault(); join(); }}>
              <input value={joinCode} maxLength={6} placeholder="ABC123" onChange={(e) => setJoinCode(e.target.value)} />
              <button type="button" className="btn small" disabled={busy} onClick={() => join()}>Join</button>
            </form>
        </>

        {msg && <p className="warn" style={{ marginTop: 12 }}>{msg}</p>}
      </div>

      <div className="footer">Players and teams are placeholders.</div>
    </div>
  );
}
