// Player card in the style of a printed cricket card: a role and country strip, then a table of
// labelled figures. Any figure that has not been loaded says "Not loaded". Nothing is invented.
const BATTING = ["Batter", "Keeper", "All-rounder"];
const BOWLING = ["Bowler", "All-rounder"];

const shown = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
};

export default function CardStats({ player: p }) {
  const bat = BATTING.includes(p.role);
  const bowl = BOWLING.includes(p.role);
  const centuries = p.hundreds == null && p.fifties == null ? null : `${p.hundreds ?? 0} / ${p.fifties ?? 0}`;

  const rows = [
    ["Matches", p.matches, "#e5e7eb"],
    ...(bat ? [
      ["Runs", p.runs, "#facc15"],
      ["Average", p.average, "#38bdf8"],
      ["Strike rate", p.strike_rate, "#f472b6"],
      ["100s / 50s", centuries, "#facc15"],
      ...(p.role !== "All-rounder" ? [["Not out", p.not_out, "#38bdf8"]] : []),
    ] : []),
    ...(bowl ? [
      ["Wickets", p.wickets, "#f87171"],
      ["Economy", p.economy, "#c084fc"],
      ...(p.role !== "All-rounder" ? [["Best bowling", p.best_bowling, "#fb923c"]] : []),
    ] : []),
  ];

  return (
    <div className="pcard">
      <div className="pcard-strip">
        <span>{p.role}</span>
        <span>{p.country}</span>
      </div>
      <table className="pcard-table">
        <tbody>
          {rows.map(([label, value, colour]) => {
            const text = shown(value);
            return (
              <tr key={label}>
                <td style={{ color: colour }}>{label}</td>
                <td className={text === null ? "empty" : ""}>{text ?? "Not loaded"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// A compact line of figures, shown straight under the player's name, like a scoreboard strip.
// Only the figures that match the role are shown.
export function StatLine({ player: p }) {
  const bat = BATTING.includes(p.role);
  const bowl = BOWLING.includes(p.role);
  const items = [["M", p.matches, "#e5e7eb"]];
  if (bat) items.push(["Runs", p.runs, "#facc15"], ["Avg", p.average, "#38bdf8"], ["SR", p.strike_rate, "#f472b6"]);
  if (bowl) items.push(["Wkts", p.wickets, "#f87171"], ["Econ", p.economy, "#c084fc"]);
  if (p.role === "Bowler") items.push(["Best", p.best_bowling, "#fb923c"]);
  const filled = items.filter(([, value]) => shown(value) !== null);
  if (!filled.length) return null;
  return (
    <div className="statline">
      {filled.map(([label, value, colour]) => (
        <span key={label}>
          <b style={{ color: colour }}>{label}</b> {shown(value)}
        </span>
      ))}
    </div>
  );
}

// IPL career figures, shown on their own line and labelled IPL. Only the figures the source supplied.
export function IplLine({ player: p }) {
  const ipl = p.formats?.ipl;
  if (!ipl) return null;
  const bat = BATTING.includes(p.role);
  const bowl = BOWLING.includes(p.role);
  const items = [];
  if (bat) {
    if (ipl.innings != null) items.push(["Inn", ipl.innings, "#e5e7eb"]);
    if (ipl.runs != null) items.push(["Runs", ipl.runs, "#facc15"]);
    if (ipl.strike_rate != null) items.push(["SR", ipl.strike_rate, "#f472b6"]);
    if (ipl.highest != null) items.push(["HS", ipl.highest, "#facc15"]);
    if (ipl.fifties != null) items.push(["50s", ipl.fifties, "#38bdf8"]);
  }
  if (bowl) {
    if (ipl.bowl_innings != null) items.push(["Bowl inn", ipl.bowl_innings, "#e5e7eb"]);
    if (ipl.wickets != null) items.push(["Wkts", ipl.wickets, "#f87171"]);
    if (ipl.economy != null) items.push(["Econ", ipl.economy, "#c084fc"]);
  }
  if (!items.length) return null;
  return (
    <div className="statline ipl-line">
      <span className="ipl-tag">IPL</span>
      {items.map(([label, value, colour]) => (
        <span key={label}><b style={{ color: colour }}>{label}</b> {shown(value)}</span>
      ))}
    </div>
  );
}

// One line per international format (Test, ODI, T20I) with the figures that match the role.
export function FormatLines({ player: p }) {
  const bat = BATTING.includes(p.role);
  const bowl = BOWLING.includes(p.role);
  const names = { test: "TEST", odi: "ODI", t20i: "T20I" };
  return (
    <>
      {Object.keys(names).map((key) => {
        const f = p.formats?.[key];
        if (!f) return null;
        const items = [["M", f.matches, "#e5e7eb"]].filter(([, v]) => v != null);
        if (bat) {
          if (f.runs != null) items.push(["Runs", f.runs, "#facc15"]);
          if (f.batting_average != null) items.push(["Avg", f.batting_average, "#38bdf8"]);
          if (f.highest != null) items.push(["HS", f.highest, "#facc15"]);
        }
        if (bowl) {
          if (f.wickets != null) items.push(["Wkts", f.wickets, "#f87171"]);
          if (f.economy != null) items.push(["Econ", f.economy, "#c084fc"]);
          if (f.best_bowling != null) items.push(["Best", f.best_bowling, "#fb923c"]);
        }
        if (items.length < 1) return null;
        return (
          <div key={key} className="statline format-line">
            <span className="format-tag">{names[key]}</span>
            {items.map(([label, value, colour]) => (
              <span key={label}><b style={{ color: colour }}>{label}</b> {shown(value)}</span>
            ))}
          </div>
        );
      })}
    </>
  );
}
