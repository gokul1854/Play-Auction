import { useEffect, useRef, useState } from "react";
import { send } from "../socket.js";
import LotCard from "../components/LotCard.jsx";
import SquadCard from "../components/SquadCard.jsx";
import PlayerList from "../components/PlayerList.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import SimPanel from "../components/SimPanel.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import SoldFlash from "../components/SoldFlash.jsx";
import { isSoundOn, setSoundOn, onSoundChange, playCountdown, playLotOpen, playBid, playUnsold, playPause, playResume } from "../sound.js";

const fmt = (u) => (u / 100).toFixed(2) + " Cr";

// Groups players by set. Consecutive players in the same category form one set.
function groupBySet(list) {
  const sets = [];
  for (const p of list) {
    const last = sets[sets.length - 1];
    if (last && last.category === p.category) last.items.push(p);
    else sets.push({ category: p.category, items: [p] });
  }
  return sets;
}

export default function Auction({ state, myId, now, navigate }) {
  const a = state.auction;
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("chat");
  const [statsTab, setStatsTab] = useState("up");
  const [soundOn, setSoundState] = useState(isSoundOn());
  useEffect(() => onSoundChange(setSoundState), []);

  function toggleSound() {
    setSoundOn(!soundOn);
    if (!soundOn) playCountdown("tick"); // a click confirms the sound is on, and unlocks audio on some phones
  }
  const [roleFilter, setRoleFilter] = useState("All");
  const [flash, setFlash] = useState(null);
  // Sounds for lot opening, bids, and pause or resume. Each one plays when the value changes, not on page load.
  const lotId = a?.current?.id ?? null;
  const lotSeen = useRef(lotId);
  useEffect(() => { if (lotId !== lotSeen.current) { lotSeen.current = lotId; if (lotId != null) playLotOpen(); } }, [lotId]);
  const bidSeen = useRef(a?.currentBid ?? null);
  useEffect(() => { const b = a?.currentBid ?? null; if (b !== bidSeen.current) { bidSeen.current = b; if (b != null) playBid(); } }, [a?.currentBid]);
  const pausedSeen = useRef(!!a?.paused);
  useEffect(() => { const p = !!a?.paused; if (p !== pausedSeen.current) { pausedSeen.current = p; if (p) playPause(); else playResume(); } }, [a?.paused]);

  // The server numbers each closed lot. Flash each new number once, and never on page load.
  const closeId = a?.lastClose?.id ?? null;
  const [seenClose, setSeenClose] = useState(closeId);
  useEffect(() => {
    if (closeId == null || closeId === seenClose) return;
    setSeenClose(closeId);
    setFlash(a.lastClose);
    if (a.lastClose.type === "unsold") playUnsold();
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [closeId]);

  if (!a) return <p className="muted">Starting…</p>;

  const myTeam = Object.keys(state.claims).find((t) => state.claims[t] === myId) ?? null;
  const mine = a.teams.find((t) => t.id === myTeam) ?? null;
  const isHost = state.hostId === myId;
  const finished = state.status === "finished" || a.status === "finished";
  const online = state.members.filter((m) => m.connected).length;
  const leadingMe = !!myTeam && a.leaderId === myTeam;

  const nameOfTeam = (teamId) => {
    const owner = state.claims[teamId];
    return state.members.find((m) => m.id === owner)?.name ?? teamId;
  };

  let reason = null;
  if (a.paused) reason = "Paused";
  else if (!myTeam) reason = "Spectating";
  else if (!a.current) reason = "Waiting for next lot";
  else if (leadingMe) reason = "You hold the highest bid";
  else if (mine && mine.purse < a.nextBid) reason = "Not enough purse";
  else if (mine && mine.squadCount >= 25) reason = "Your squad is full";
  else if (mine && a.current && a.current.country !== "India" && a.overseasLimit != null && (mine.squad ?? []).filter((x) => x.country !== "India").length >= a.overseasLimit) reason = "Overseas limit reached";

  async function bid(amount) {
    const r = await send("auction:bid", { amount });
    if (!r.ok) setMsg(r.error);
  }

  async function togglePause() {
    const r = await send(a.paused ? "auction:resume" : "auction:pause", {});
    if (!r.ok) setMsg(r.error);
  }

  async function stop() {
    const r = await send("room:stop");
    if (!r.ok) setMsg(r.error);
  }

  const baseRows =
    statsTab === "up" ? (a.upcoming ?? [])
    : statsTab === "sold" ? [...a.sold].reverse()
    : statsTab === "unsold" ? (a.unsold ?? [])
    : [...a.sold].sort((x, y) => y.price - x.price).slice(0, 15);
  const statsRows = baseRows.filter((p) => roleFilter === "All" || p.role === roleFilter);

  const tabs = [
    ["chat", "Chat"],
    ["squads", `Squads`],
    ["stats", "Stats"],
    ["sim", "Sim"],
    ["settings", "Settings"],
  ];

  return (
    <div>
      <div className="topbar">
        <button type="button" className="iconbtn" onClick={() => navigate("/")} aria-label="Home">⌂</button>
        <span className="topbar-title"><span className="code">{state.code}</span></span>
        <span className="online">● {online}/{state.members.length}</span>
        <button type="button" className="btn purple small" onClick={() => setTab("sim")}>Sim</button>
        <button type="button" className="btn ghost small sound-btn" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? "Sound on, tap to mute" : "Sound off, tap to turn on"}>{soundOn ? "🔊" : "🔇"}</button>
        {isHost && !finished && a.current && (
          <button type="button" className="btn pause small" onClick={togglePause}>{a.paused ? "Resume" : "Pause"}</button>
        )}
        {isHost && !finished && <button type="button" className="btn ghost small" onClick={stop}>End</button>}
      </div>

      {finished
        ? <div className="card"><p className="label">Auction complete</p><p className="muted">{a.sold.length} sold · {a.unsoldCount} unsold</p></div>
        : a.current
          ? <div className="lot-wrap">
              <LotCard
                lot={a.current}
                upcoming={a.upcoming}
                windowMs={a.windowMs}
                paused={a.paused}
                pausedLeft={a.pausedLeft}
                deadline={a.deadline}
                now={now}
                currentBid={a.currentBid}
                leaderName={a.leaderId ? nameOfTeam(a.leaderId) : null}
                nextBid={a.nextBid}
                purse={mine?.purse ?? null}
                reason={reason}
                onBid={bid}
                onOpenStats={() => { setTab("stats"); setStatsTab("up"); }}
              />
              {flash && flash.type === "sold" && <SoldFlash ev={flash} />}
              {flash && flash.type === "unsold" && (
                <div className="flash unsold">
                  <b>UNSOLD</b>
                  <span>No bids received</span>
                </div>
              )}
            </div>
          : <div className="card muted">Next lot is loading…</div>}
      {msg && <p className="warn">{msg}</p>}

      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn t-${id}${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <ChatPanel state={state} myId={myId} />}

      {tab === "squads" && a.teams.map((t) => (
        <SquadCard key={t.id} team={t} owner={nameOfTeam(t.id)} isMe={t.id === myTeam} />
      ))}

      {tab === "stats" && (
        <div className="card">
          <div className="seg">
            <button type="button" className={statsTab === "up" ? "on" : ""} onClick={() => setStatsTab("up")}>Up ({(a.upcoming ?? []).length})</button>
            <button type="button" className={statsTab === "sold" ? "on" : ""} onClick={() => setStatsTab("sold")}>Sold ({a.sold.length})</button>
            <button type="button" className={statsTab === "unsold" ? "on" : ""} onClick={() => setStatsTab("unsold")}>Unsold ({a.unsoldCount})</button>
            <button type="button" className={statsTab === "top" ? "on" : ""} onClick={() => setStatsTab("top")}>Top</button>
          </div>
          <div className="seg role-seg">
            {["All", "Batter", "Bowler", "All-rounder", "Keeper"].map((r) => (
              <button key={r} type="button" className={roleFilter === r ? "on" : ""} onClick={() => setRoleFilter(r)}>{r === "All" ? "All roles" : r + "s"}</button>
            ))}
          </div>

          {statsTab === "up" && (
            <>
              <p className="info">Players come up in set order: Legends, Marquee, Capped, then Uncapped. Players inside a set are shuffled.</p>
              {groupBySet(statsRows).map((set, i) => (
                <div key={`${set.category}-${i}`}>
                  <div className="set-head">{set.category} Set · {set.items.length} players</div>
                  <PlayerList items={set.items} emptyText="" />
                </div>
              ))}
              {statsRows.length === 0 && <p className="muted">No players left to come up.</p>}
            </>
          )}

          {statsTab !== "up" && (
            <PlayerList
              items={statsRows}
              emptyText={statsTab === "sold" ? "No players sold yet. Sold players will appear here." : "Nothing here yet."}
              showPrice={statsTab !== "unsold"}
            />
          )}
        </div>
      )}

      {tab === "sim" && <SimPanel state={state} />}

      {tab === "settings" && <SettingsPanel state={state} isHost={isHost} />}
    </div>
  );
}
