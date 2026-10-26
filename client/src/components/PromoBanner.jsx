import { useState } from "react";

// Dismissible promo card. Pass `href` to link somewhere; leave it out for a plain card.
export default function PromoBanner({ title, subtitle, href }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const body = (
    <>
      <div><b>{title}</b><div className="muted" style={{ fontSize: 12 }}>{subtitle}</div></div>
      <button type="button" className="btn ghost small" onClick={(e) => { e.preventDefault(); setOpen(false); }} aria-label="Dismiss">×</button>
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className="card promo row">{body}</a>
    : <div className="card promo row">{body}</div>;
}
