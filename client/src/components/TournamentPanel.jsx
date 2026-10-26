import { useState } from "react";
import { send } from "../socket.js";
import { TEAM_BY_CODE } from "../data/teams.js";
import { Scorecard } from "./SimPanel.jsx";

// One fixture in a list. Tap it to open the full scorecard.
function Fixture({ m, onOpen }) {
  return (
    <button type="button" className="fixture" onClick={() => onOpen(m.id)}>
      <div className="row">
        <span className="muted">{m.stage}</span>
        <span className="muted">#{m.id}</span>
      </div>
      <div><b>{m.home}</b> vs <b>{m.away}</b></div>
      <div className="muted" style={{ fontSize: 12 }}>{m.text}</div>
    </button>
  );
}

// Full scorecard for one match, opened from a fixture.
function MatchDetail({ match, onClose }) {
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="label" style={{ margin: 0 }}>{match.home} vs {match.away}</span>
        <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
      </div>
      {match.innings.map((inn, k) => (
        <div key={k}>
          <div className="sb-row">
            <span className="sb-team" style={{ color: TEAM_BY_CODE[inn.code]?.color }}>{inn.code}</span>
            <span className="sb-score">{inn.runs}/{inn.wickets}</span>
            <span className="muted">{inn.overs} ov</span>
          </div>
          <Scorecard innings={inn} />
        </div>
      ))}
      <p className="sb-result">{match.text}</p>
    </div>
  );
}

export default function TournamentPanel({ state }) {
  const t = state.tournament;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState(null);
  const teams = state.auction?.teams ?? [];
  const teamCount = teams.length;
  const short = teams.filter((x) => x.squadCount < 11);

  async function run() {
    setBusy(true);
    const r = await send("tournament:run", {});
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setMsg("");
    setDetail(null);
  }

  async function open(id) {
    const r = await send("tournament:match", { id });
    if (!r.ok) return setMsg(r.error);
    setMsg("");
    setDetail(r.match);
  }

  return (
    <div>
      <div className="card">
        <p className="label">Tournament</p>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Every team plays every other team once. The top four go to playoffs, as in the IPL. Win is 2 points, a tie is 1. Ties on points are settled by net run rate.
        </p>
        <button type="button" className="btn" disabled={busy || teamCount < 2 || short.length > 0} onClick={run}>
          {busy ? "Running the tournament…" : t ? "Run again" : "Run tournament"}
        </button>
        {teamCount < 2 && <p className="muted" style={{ marginTop: 10 }}>Two or more teams must be in the auction.</p>}
        {short.length > 0 && <p className="warn">Each team needs 11 bought players. Short: {short.map((x) => `${x.id} (${x.squadCount})`).join(", ")}.</p>}
        {msg && <p className="warn">{msg}</p>}
      </div>

      {t && (
        <>
          {t.champion && (
            <div className="card champ">
              <p className="label">Champions</p>
              <div className="champ-name" style={{ color: TEAM_BY_CODE[t.champion]?.color }}>
                {t.champion} · {TEAM_BY_CODE[t.champion]?.name}
              </div>
            </div>
          )}

          <div className="card">
            <p className="label">Points table</p>
            <table className="scorecard">
              <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead>
              <tbody>
                {t.table.map((r) => (
                  <tr key={r.code} className={r.position <= 4 ? "qualify" : ""}>
                    <td>{r.position}</td>
                    <td><b>{r.code}</b></td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.lost}</td>
                    <td><b>{r.points}</b></td>
                    <td>{r.nrr >= 0 ? "+" : ""}{r.nrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Top four qualify for the playoffs.</p>
          </div>

          <div className="card">
            <p className="label">Playoffs</p>
            {t.playoffs.length === 0
              ? <p className="muted">Playoffs need at least two teams.</p>
              : t.playoffs.map((m) => <Fixture key={m.id} m={m} onOpen={open} />)}
          </div>

          {detail && <MatchDetail match={detail} onClose={() => setDetail(null)} />}

          <div className="card">
            <p className="label">League matches</p>
            {t.league.map((m) => <Fixture key={m.id} m={m} onOpen={open} />)}
          </div>
        </>
      )}
    </div>
  );
}
