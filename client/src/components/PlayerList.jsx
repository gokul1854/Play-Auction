const fmt = (u) => (u / 100).toFixed(2) + " Cr";

// Colour per auction category, used for names and the left edge of each row.
export const CATEGORY_COLOR = {
  Legend: "#f472b6",
  Marquee: "#facc15",
  Capped: "#38bdf8",
  Uncapped: "#2dd4bf",
};

// A list of players with category, role, country, and a price. `showPrice` picks sold price or base price.
export default function PlayerList({ items, emptyText, showPrice = false }) {
  if (!items.length) return <p className="muted">{emptyText}</p>;
  return (
    <div>
      {items.map((p, i) => {
        const color = CATEGORY_COLOR[p.category] ?? "#9a9aa5";
        return (
          <div key={`${p.name}-${i}`} className="prow" style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10 }}>
            <div>
              <b style={{ color }}>{p.name}</b>{p.country !== "India" && <span className="os-tag">✈ OS</span>}
              <div className="muted" style={{ fontSize: 12 }}>
                {p.category} · {p.role} · {p.country}{p.teamId ? ` · ${p.teamId}` : ""}
              </div>
            </div>
            <b style={{ color: "#f2f2f4" }}>{fmt(showPrice ? p.price : p.basePrice)}</b>
          </div>
        );
      })}
    </div>
  );
}
