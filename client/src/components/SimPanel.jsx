import { useEffect, useMemo, useState } from "react";
import { send } from "../socket.js";
import { TEAM_BY_CODE } from "../data/teams.js";
import TournamentPanel from "./TournamentPanel.jsx";

const XI = 11; // a team needs this many bought players to play

// Flattens both innings into one list of balls so the scoreboard can replay them in order.
function timelineOf(result) {
  const t = [];
  result.innings.forEach((inn, i) => inn.log.forEach((e) => t.push({ ...e, inn: i })));
  return t;
}

// Runs and wickets for each innings after the first k balls.
function scoresAt(result, timeline, k) {
  const s = result.innings.map(() => ({ runs: 0, wkts: 0 }));
  for (let j = 0; j < k && j < timeline.length; j++) {
    const e = timeline[j];
    s[e.inn].runs += e.runs;
    if (e.wicket) s[e.inn].wkts += 1;
  }
  return s;
}

// Batting and bowling tables for one innings.
export function Scorecard({ innings }) {
  const batters = innings.batters.filter((b) => b.balls > 0 || b.out);
  return (
    <div>
      <p className="label" style={{ marginTop: 14 }}>Batting · {innings.code}</p>
      <table className="scorecard">
        <thead><tr><th>Batter</th><th>R</th><th>B</th><th>Status</th></tr></thead>
        <tbody>
          {batters.map((b) => (
            <tr key={b.name}>
              <td>{b.name}</td>
              <td><b>{b.runs}</b></td>
              <td>{b.balls}</td>
              <td className="muted">{b.out ? "out" : "not out"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="label" style={{ marginTop: 14 }}>Bowling</p>
      <table className="scorecard">
        <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead>
        <tbody>
          {innings.bowlers.filter((b) => b.balls > 0).map((b) => (
            <tr key={b.name}>
              <td>{b.name}</td>
              <td>{Math.floor(b.balls / 6)}.{b.balls % 6}</td>
              <td>{b.runs}</td>
              <td><b>{b.wickets}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchSim({ state }) {
  const teams = state.auction?.teams ?? [];
  const teamCodes = teams.map((t) => t.id);
  const sizeOf = (code) => teams.find((t) => t.id === code)?.squadCount ?? 0;
  const [home, setHome] = useState(teamCodes[0] ?? "");
  const [away, setAway] = useState(teamCodes[1] ?? "");
  const shortTeams = [home, away].filter((c) => c && sizeOf(c) < XI);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [replay, setReplay] = useState(null); // { id, step }
  const [view, setView] = useState("score"); // score | card
  const [inn, setInn] = useState(0);

  const sim = state.lastSim;
  const timeline = useMemo(() => (sim ? timelineOf(sim.result) : []), [sim?.id]);
  const replaying = !!replay && !!sim && replay.id === sim.id;

  useEffect(() => {
    if (!replaying || replay.step >= timeline.length) return;
    const t = setTimeout(() => setReplay((r) => ({ ...r, step: r.step + 1 })), 200);
    return () => clearTimeout(t);
  }, [replaying, replay, timeline.length]);

  async function run() {
    if (!home || !away) return setMsg("Pick two teams");
    if (home === away) return setMsg("Pick two different teams");
    if (shortTeams.length) return setMsg(`Each team needs ${XI} bought players. Short: ${shortTeams.map((c) => `${c} (${sizeOf(c)})`).join(", ")}`);
    setBusy(true);
    const r = await send("sim:run", { home, away });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setMsg("");
    setView("score");
    setReplay({ id: r.id, step: 0 });
  }

  const scores = replaying
    ? scoresAt(sim.result, timeline, replay.step)
    : sim?.result.innings.map((i) => ({ runs: i.runs, wkts: i.wickets, overs: i.overs }));
  const comments = replaying
    ? timeline.slice(Math.max(0, replay.step - 6), replay.step).reverse()
    : timeline.slice(-6).reverse();
  const inProgress = replaying && replay.step < timeline.length;

  return (
    <div>
      <div className="card">
        <p className="label">Match simulator</p>
        <div className="sim-pick">
          <select value={home} onChange={(e) => setHome(e.target.value)} aria-label="Home team">
            {teamCodes.map((c) => <option key={c} value={c}>{c} · {sizeOf(c)} players</option>)}
          </select>
          <span className="muted">vs</span>
          <select value={away} onChange={(e) => setAway(e.target.value)} aria-label="Away team">
            {teamCodes.map((c) => <option key={c} value={c}>{c} · {sizeOf(c)} players</option>)}
          </select>
        </div>
        {shortTeams.length > 0 && <p className="warn">Buy more players first. {shortTeams.map((c) => `${c} has ${sizeOf(c)} of ${XI}`).join(", ")}.</p>}
        <button type="button" className="btn" disabled={busy || teamCodes.length < 2 || shortTeams.length > 0} onClick={run}>
          {busy ? "Simulating…" : "Simulate match"}
        </button>
        {msg && <p className="warn">{msg}</p>}
        <p className="muted" style={{ margin: "10px 0 0" }}>
          Strength comes from each player's auction category. Short squads are padded with replacements.
        </p>
      </div>

      {sim && (
        <div className="card scoreboard">
          <div className="sb-head">
            <span className="muted">{sim.home} vs {sim.away}</span>
            <span className="muted">{inProgress ? "Live" : "Final"}</span>
          </div>
          {sim.result.innings.map((i, k) => (
            <div key={k} className="sb-row">
              <span className="sb-team" style={{ color: TEAM_BY_CODE[i.code]?.color }}>{i.code}</span>
              <span className="sb-score">{scores[k].runs}/{scores[k].wkts}</span>
              <span className="muted">{replaying ? "" : `${scores[k].overs} ov`}</span>
            </div>
          ))}
          <p className="sb-result">{inProgress ? "In progress…" : sim.result.text}</p>

          <div className="seg" style={{ marginTop: 8 }}>
            <button type="button" className={view === "score" ? "on" : ""} onClick={() => setView("score")}>Commentary</button>
            <button type="button" className={view === "card" ? "on" : ""} onClick={() => setView("card")}>Scorecard</button>
          </div>

          {view === "score" && (
            <div className="feed">
              {comments.map((e, i) => (
                <div key={i}><span className="muted">{e.over}</span> {e.text}</div>
              ))}
            </div>
          )}

          {view === "card" && (
            <div>
              <div className="seg">
                <button type="button" className={inn === 0 ? "on" : ""} onClick={() => setInn(0)}>1st innings</button>
                <button type="button" className={inn === 1 ? "on" : ""} onClick={() => setInn(1)}>2nd innings</button>
              </div>
              <Scorecard innings={sim.result.innings[inn]} />
            </div>
          )}

          <button type="button" className="btn ghost small" style={{ marginTop: 10 }} onClick={() => { setReplay({ id: sim.id, step: 0 }); setView("score"); }}>
            Replay
          </button>
        </div>
      )}

      {state.sims?.length > 0 && (
        <div className="card">
          <p className="label">Recent matches</p>
          {[...state.sims].reverse().map((s) => (
            <div key={s.id} className="prow" style={{ paddingLeft: 0 }}>
              <span>{s.home} vs {s.away}</span>
              <span className="muted">{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The simulator: a single match, or a whole tournament.
export default function SimPanel({ state }) {
  const [mode, setMode] = useState("match");
  return (
    <div>
      <div className="seg">
        <button type="button" className={mode === "match" ? "on" : ""} onClick={() => setMode("match")}>Single match</button>
        <button type="button" className={mode === "tournament" ? "on" : ""} onClick={() => setMode("tournament")}>Tournament</button>
      </div>
      {mode === "match" ? <MatchSim state={state} /> : <TournamentPanel state={state} />}
    </div>
  );
}
