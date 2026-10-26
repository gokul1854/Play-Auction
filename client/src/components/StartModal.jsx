// Shown when the host starts with empty teams. Empty teams sit out the bidding.
export default function StartModal({ joined, total, onStart, onWait }) {
  return (
    <div className="modal show" role="dialog" aria-modal="true">
      <div className="card" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px" }}>Only {joined} of {total} teams joined</h2>
        <p className="muted">Teams with no players won't take part in the bidding. Others can still claim them mid-auction.</p>
        <button className="btn" onClick={onStart}>Start Anyway</button>
        <div style={{ height: 8 }} />
        <button className="btn ghost" onClick={onWait}>Wait for Others</button>
      </div>
    </div>
  );
}
