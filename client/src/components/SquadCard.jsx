import PlayerList from "./PlayerList.jsx";
import TeamBadge from "./TeamBadge.jsx";
import { TEAM_BY_CODE, teamName } from "../data/teams.js";

const fmt = (u) => (u / 100).toFixed(2) + " Cr";
const ROLES = ["Batter", "Bowler", "All-rounder", "Keeper"];

// One team's squad, visible to everyone. The card takes the franchise colour.
export default function SquadCard({ team, owner, isMe }) {
  const info = TEAM_BY_CODE[team.id] ?? { color: "#444" };
  // Batters first, then wicketkeepers, then all-rounders, then bowlers. Purchase order is kept within each role.
  const ROLE_RANK = { Batter: 0, Keeper: 1, "All-rounder": 2, Bowler: 3 };
  const squad = [...(team.squad ?? [])].sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9));
  const count = (role) => squad.filter((p) => p.role === role).length;
  const label = (role) => (role === "All-rounder" ? "all-rounders" : role.toLowerCase() + (count(role) === 1 ? "" : "s"));
  return (
    <div
      className="card squad"
      style={{
        borderColor: info.color,
        background: `linear-gradient(160deg, ${info.color}33, #17171c 55%)`,
      }}
    >
      <div className="row" style={{ marginBottom: 6 }}>
        <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
          <div className="crest" style={{ width: 44, height: 44, margin: 0 }}>
            <TeamBadge code={team.id} color={info.color} owned />
          </div>
          <div>
            <b style={{ color: `color-mix(in srgb, ${info.color} 45%, white)`, fontSize: 16 }}>{teamName(team.id)}</b>
            <div className="muted" style={{ fontSize: 12 }}>{team.id}{isMe ? " · you" : ""} · {owner}</div>
          </div>
        </div>
        <span className="pill" style={{ background: info.color, color: "#fff" }}>{team.squadCount}</span>
      </div>
      <p className="muted" style={{ margin: "0 0 6px" }}>Purse left <b style={{ color: "#22c55e" }}>{fmt(team.purse)}</b></p>
      <div className="role-counts">
        {ROLES.map((r) => (
          <span key={r} className="role-chip">{count(r)} {label(r)}</span>
        ))}
        <span className="role-chip os-chip">✈ {squad.filter((p) => p.country !== "India").length} overseas</span>
      </div>
      <PlayerList items={squad} emptyText="No players yet." showPrice />
    </div>
  );
}
