// Full figures for the player on the lot: career, then each format that has figures.
// Only the values that are filled in are shown; nothing is shown as a placeholder.
const LABELS = {
  matches: "Matches", runs: "Runs", batting_average: "Average", average: "Average", strike_rate: "Strike rate",
  hundreds: "100s", fifties: "50s", not_out: "Not out", highest: "Highest", balls: "Balls", wickets: "Wickets",
  economy: "Economy", bowling_average: "Bowling avg", best_bowling: "Best bowling", five_wickets: "5-wicket hauls",
  catches: "Catches", innings: "Innings", bowl_innings: "Bowling inn", bowl_matches: "Bowling matches",
};
const FORMAT_TITLES = { test: "Test", odi: "ODI", t20i: "T20I", ipl: "IPL" };
const CAREER_KEYS = ["matches", "runs", "average", "strike_rate", "hundreds", "fifties", "not_out", "highest", "balls", "wickets", "economy", "best_bowling", "catches"];

const shown = (v) => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2) : String(v));

function rowsFrom(obj, keys) {
  return (keys ?? Object.keys(obj))
    .filter((k) => obj[k] != null && LABELS[k])
    .map((k) => [LABELS[k], obj[k]]);
}

export default function PlayerDetails({ player: p }) {
  const sections = [];
  const career = rowsFrom(p, CAREER_KEYS);
  if (career.length) sections.push(["Career", career]);
  for (const key of Object.keys(FORMAT_TITLES)) {
    const f = p.formats?.[key];
    if (!f) continue;
    const rows = rowsFrom(f);
    if (rows.length) sections.push([FORMAT_TITLES[key], rows]);
  }
  return (
    <div className="pd">
      <div className="pd-title">{p.name} <span className="muted">· {p.role}</span></div>
      {sections.length === 0 && <p className="muted" style={{ margin: 0 }}>No figures loaded yet.</p>}
      {sections.map(([title, rows]) => (
        <div key={title} className="pd-sec">
          <b>{title}</b>
          <div className="pd-grid">
            {rows.map(([label, value]) => (
              <span key={label}><i>{label}</i> {shown(value)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The players still to come, in auction order. Shows each player's set, role, country and base price.
export function UpcomingList({ upcoming = [] }) {
  if (!upcoming.length) {
    return <div className="pd"><div className="pd-title">Upcoming players</div><p className="muted" style={{ margin: 0 }}>No players left to auction.</p></div>;
  }
  const money = (u) => (u / 100).toFixed(2) + " Cr";
  return (
    <div className="pd">
      <div className="pd-title">Upcoming players <span className="muted">· {upcoming.length} left</span></div>
      <ol className="up-list">
        {upcoming.slice(0, 40).map((p, i) => (
          <li key={`${p.name}-${i}`}>
            <span className="up-n">{i + 1}</span>
            <span className="up-name">{p.name}</span>
            <span className="muted up-meta">{p.role} · {p.country} · {p.category}</span>
            <span className="up-price">{money(p.basePrice)}</span>
          </li>
        ))}
      </ol>
      {upcoming.length > 40 && <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Showing the next 40 of {upcoming.length}.</p>}
    </div>
  );
}
