import { TEAMS } from "../data/teams.js";
import TeamBadge from "./TeamBadge.jsx";

// Team circles in a grid: IPL franchises or national teams, depending on the room. Only your own name is shown.
export default function TeamPicker({ claims, members, myId, onPick, teams = TEAMS }) {
  const myName = members.find((m) => m.id === myId)?.name ?? "";
  return (
    <div className="team-circles">
      {teams.map((team) => {
        const owner = claims[team.code];
        const mine = owner === myId;
        const taken = !!owner && !mine;
        return (
          <button
            key={team.code}
            type="button"
            className={`tc${mine ? " mine" : ""}${taken ? " taken" : ""}`}
            onClick={() => { if (!taken) onPick(team.code); }}
            title={team.name}
            aria-label={`${team.name}${taken ? ", taken" : mine ? ", your team" : ", open"}`}
          >
            <span className="tc-circle">
              <TeamBadge code={team.code} color={team.color} owned={!!owner} />
            </span>
            <small>{mine ? myName : ""}</small>
          </button>
        );
      })}
    </div>
  );
}
