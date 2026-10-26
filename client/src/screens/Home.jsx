import { useEffect, useState } from "react";
import TeamBadge from "../components/TeamBadge.jsx";
import { MODES } from "../data/modes.js";
import { TEAM_BY_CODE, teamsForSet } from "../data/teams.js";
import { getName, send, setName, socket } from "../socket.js";

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home({ navigate }) {
  const [name, setNameState] = useState(getName());
  const [team, setTeam] = useState(null);
  const [visibility, setVisibility] = useState("public");
  const [mode, setMode] = useState("full");
  const [teamSet, setTeamSet] = useState("ipl");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTarget, setMsgTarget] = useState("create");
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(socket.connected ? "connected" : "connecting");

  useEffect(() => {
    document.body.classList.add("home-page");
    return () => document.body.classList.remove("home-page");
  }, []);

  useEffect(() => {
    let active = true;
    let refreshTimer;
    setConnectionStatus(socket.connected ? "connected" : "connecting");

    async function refreshRooms() {
      const result = await send("rooms:browse");
      if (!active) return;
      if (!result.ok) {
        setRoomsError(result.error || "Could not load public rooms.");
        setRoomsLoading(false);
        return;
      }
      setRooms(Array.isArray(result.data) ? result.data : []);
      setRoomsError("");
      setRoomsLoading(false);
    }

    refreshRooms();
    refreshTimer = window.setInterval(refreshRooms, 15000);
    const onConnect = () => {
      setConnectionStatus("connected");
      refreshRooms();
    };
    const onDisconnect = () => setConnectionStatus("connecting");
    const onConnectError = () => setConnectionStatus("offline");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  function requireName(target) {
    const cleanName = name.trim();
    if (!cleanName) {
      setMsgTarget(target);
      setMsg("Enter your name first.");
      scrollTo(target === "join" ? "join-room" : "create-room");
      return null;
    }
    setName(cleanName);
    return cleanName;
  }

  async function create() {
    const cleanName = requireName("create");
    if (!cleanName) return;
    if (!team) {
      setMsgTarget("create");
      setMsg("Choose your team to create a room.");
      scrollTo("create-room");
      return;
    }

    setBusy(true);
    setMsgTarget("create");
    setMsg("");
    const result = await send("room:create", { name: cleanName, visibility, mode, teamSet });
    if (!result.ok) {
      setBusy(false);
      setMsg(result.error || "The room could not be created. Please try again.");
      return;
    }

    if (!/^[A-Z0-9]{6}$/.test(result.roomCode ?? "")) {
      setBusy(false);
      setMsg("The room was created, but its code was not returned. Please refresh and check your rooms.");
      return;
    }

    const claim = await send("team:claim", { teamId: team });
    setBusy(false);
    if (!claim.ok) {
      setMsg(`Room ${result.roomCode} was created, but your team could not be claimed: ${claim.error}`);
      return;
    }
    navigate(`/room/${result.roomCode}`);
  }

  async function join(code = joinCode) {
    const cleanName = requireName("join");
    if (!cleanName) return;
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setMsgTarget("join");
      setMsg("Enter a room code.");
      scrollTo("join-room");
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      setMsgTarget("join");
      setMsg("Room codes are six letters or numbers.");
      scrollTo("join-room");
      return;
    }

    setBusy(true);
    setMsgTarget("join");
    setMsg("");
    const result = await send("room:join", { code: cleanCode, name: cleanName });
    setBusy(false);
    if (!result.ok) {
      setMsg(result.error || "Could not join that room. Check the code and try again.");
      return;
    }
    navigate(`/room/${cleanCode}`);
  }

  const teamList = teamsForSet(teamSet);
  const liveRooms = rooms.filter((room) => room.status === "live");
  const openRooms = rooms.filter((room) => room.status === "lobby");

  return (
    <div className="wrap home-wrap" id="home">
      <header className="home-header">
        <a className="home-brand" href="#home" aria-label="Play Auction home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M9 34 27 8l3 3-8 12 13 10-2 4-15-8-6 8H9Z" fill="currentColor" />
              <path d="m27 8 7 5m-22 24h23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-copy"><b>PLAY <i>AUCTION</i></b><small>BID · BUILD · WIN</small></span>
        </a>
        <div className="header-right">
          <span className={`connection-pill${connectionStatus === "connected" ? " is-connected" : ""}${connectionStatus === "offline" ? " is-offline" : ""}`}><i /> {connectionStatus === "connected" ? "Connected" : connectionStatus === "offline" ? "Offline" : "Connecting"}</span>
          <button type="button" className="profile-pill" onClick={() => scrollTo("create-room")} title="Edit your name in the room setup">
            <span className="profile-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "P"}</span>
            <span>{name.trim() || "Your profile"}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="hero-kicker"><span /> THE ULTIMATE CRICKET AUCTION</p>
            <h1 id="home-title">Build your team.<br /><span>Own the auction.</span></h1>
            <p className="hero-description">Bring your friends together, bid for your favourite players, and build a squad that can win it all.</p>
            <div className="hero-actions">
              <button type="button" className="btn hero-primary" onClick={() => scrollTo("create-room")}>
                <span aria-hidden="true">＋</span> Create a room <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="btn ghost hero-secondary" onClick={() => scrollTo("join-room")}>Join with a code</button>
            </div>
            <div className="hero-proof"><span className="proof-dot" /> Live multiplayer <span>·</span> Real-time bidding <span>·</span> Free to play</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="stadium-glow" />
            <div className="stadium-stand stand-back" />
            <div className="stadium-stand stand-front" />
            <div className="stadium-lights lights-left">✦　✦</div>
            <div className="stadium-lights lights-right">✦　✦</div>
            <div className="trophy">
              <div className="trophy-crown">✦</div>
              <div className="trophy-cup"><span>IPL</span></div>
              <div className="trophy-handles" />
              <div className="trophy-stem" />
              <div className="trophy-base" />
              <div className="trophy-plinth" />
            </div>
            <div className="hero-art-caption"><span>THE SEASON STARTS HERE</span><b>Big bids. Bigger dreams.</b></div>
          </div>
        </section>

        <section className="quick-actions" aria-label="Quick actions">
          <button type="button" className="quick-card quick-live" onClick={() => scrollTo("live-rooms")}>
            <span className="quick-icon" aria-hidden="true">ϟ</span><b>Live rooms</b>
            <span>Find an auction in progress</span><i aria-hidden="true">→</i>
          </button>
          <button type="button" className="quick-card quick-create" onClick={() => scrollTo("create-room")}>
            <span className="quick-icon" aria-hidden="true">♟</span><b>Create room</b>
            <span>Start an auction with friends</span><i aria-hidden="true">→</i>
          </button>
          <button type="button" className="quick-card quick-join" onClick={() => scrollTo("join-room")}>
            <span className="quick-icon" aria-hidden="true">↗</span><b>Join room</b>
            <span>Enter a six-character code</span><i aria-hidden="true">→</i>
          </button>
          <button type="button" className="quick-card quick-teams" onClick={() => scrollTo("teams")}>
            <span className="quick-icon" aria-hidden="true">♛</span><b>Pick your team</b>
            <span>Choose your franchise</span><i aria-hidden="true">→</i>
          </button>
        </section>

        <section className="home-section live-section" id="live-rooms" aria-labelledby="rooms-title">
          <div className="section-heading">
            <div><p className="section-eyebrow">PLAY TOGETHER</p><h2 id="rooms-title"><span className="live-indicator" /> Public rooms</h2></div>
            <button type="button" className="text-link" disabled={roomsLoading || connectionStatus !== "connected"} onClick={() => { setRoomsLoading(true); setRoomsError(""); send("rooms:browse").then((result) => { if (result.ok) { setRooms(Array.isArray(result.data) ? result.data : []); setRoomsError(""); } else setRoomsError(result.error || "Could not load public rooms."); setRoomsLoading(false); }); }}>
              Refresh <span aria-hidden="true">↻</span>
            </button>
          </div>
          {roomsError && <p className="home-notice" role="status">{roomsError}</p>}
          {roomsLoading ? (
            <div className="rooms-empty"><span className="loading-ring" /> Checking for public rooms…</div>
          ) : liveRooms.length + openRooms.length > 0 ? (
            <div className="rooms-grid">
              {[...liveRooms, ...openRooms].slice(0, 6).map((room) => (
                <article className="room-card" key={room.code}>
                  <div className="room-card-top">
                    <span className={`room-status ${room.status === "live" ? "is-live" : ""}`}>{room.status === "live" ? "LIVE NOW" : "LOBBY"}</span>
                    <span className="room-mode">{MODES.find((item) => item.id === room.mode)?.label || "Auction"}</span>
                  </div>
                  <b className="room-host">{room.hostName}&apos;s room</b>
                  <p className="room-meta">{room.players} player{room.players === 1 ? "" : "s"} <span>·</span> {room.teamsFilled} teams ready</p>
                  <button type="button" className="room-join-btn" disabled={busy} onClick={() => join(room.code)}>Join room <span aria-hidden="true">→</span></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rooms-empty">
              <span className="empty-ball" aria-hidden="true">●</span>
              <div><b>{roomsError ? "Rooms are temporarily unavailable" : "No public rooms just yet"}</b><span>{roomsError ? "Try refreshing in a moment." : "Create a room and invite your friends, or join one with a room code."}</span></div>
              <button type="button" className="btn small" onClick={() => scrollTo("create-room")}>Start an auction</button>
            </div>
          )}
        </section>

        <section className="home-section teams-section" id="teams" aria-labelledby="teams-title">
          <div className="section-heading">
            <div><p className="section-eyebrow">CHOOSE YOUR SIDE</p><h2 id="teams-title">Find your team</h2></div>
            <div className="team-set-toggle" role="group" aria-label="Choose team set">
              {["ipl", "international"].map((set) => (
                <button type="button" key={set} className={teamSet === set ? "selected" : ""} aria-pressed={teamSet === set} onClick={() => { setTeamSet(set); setTeam(null); }}>
                  {set === "ipl" ? "IPL" : "International"}
                </button>
              ))}
            </div>
          </div>
          <div className="home-team-grid">
            {teamList.map((item) => (
              <button type="button" className={`home-team-card${team === item.code ? " selected" : ""}`} style={{ "--team-color": item.color }} key={item.code} onClick={() => { setTeam(item.code); scrollTo("create-room"); }} aria-label={`Select ${item.name} as your team`}>
                <span className="home-team-logo"><TeamBadge code={item.code} color={item.color} owned={team === item.code} /></span>
                <b>{item.code}</b><span>{item.name}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="home-lower-grid">
          <section className="home-section setup-section" id="create-room" aria-labelledby="setup-title">
            <div className="section-heading">
              <div><p className="section-eyebrow">YOUR AUCTION, YOUR RULES</p><h2 id="setup-title">Create a room</h2></div>
              <span className="setup-step">01 <i>/</i> 02</span>
            </div>
            <label className="field-label" htmlFor="player-name">Your name</label>
            <input id="player-name" value={name} maxLength={16} autoComplete="nickname" placeholder="e.g. Gokul" onChange={(event) => setNameState(event.target.value)} />

            <div className="form-row-heading"><p className="field-label">Your team</p><span>{team ? `${team} selected` : "Choose one"}</span></div>
            <div className="selected-team-note">
              {team ? <><span className="selected-team-logo" style={{ backgroundColor: TEAM_BY_CODE[team]?.color }}>{team}</span><span><b>{TEAM_BY_CODE[team]?.name}</b><small>{TEAM_BY_CODE[team]?.city}</small></span><button type="button" onClick={() => setTeam(null)}>Change</button></> : <span>Select a team from the cards above to continue.</span>}
            </div>

            <p className="field-label">Room privacy</p>
            <div className="setup-options">
              <button type="button" className={`setup-option${visibility === "public" ? " selected" : ""}`} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}><b>Public</b><span>Anyone can find and join</span></button>
              <button type="button" className={`setup-option${visibility === "private" ? " selected" : ""}`} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}><b>Private</b><span>Invite friends with a code</span></button>
            </div>

            <p className="field-label">Auction player pool</p>
            <div className="setup-mode-list">
              {MODES.map((item) => (
                <button type="button" key={item.id} className={`setup-mode${mode === item.id ? " selected" : ""}`} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
                  <span className="mode-radio" aria-hidden="true" /><span><b>{item.label}</b><small>{item.desc}</small></span>
                </button>
              ))}
            </div>
            {msg && msgTarget === "create" && <p className="home-notice" role="alert">{msg}</p>}
            <button type="button" className="btn create-submit" disabled={busy || connectionStatus !== "connected"} onClick={create}>{busy ? "Creating room…" : connectionStatus !== "connected" ? "Waiting for connection…" : "Create auction room"} <span aria-hidden="true">→</span></button>
          </section>

          <aside className="home-side-column">
            <section className="home-section join-section" id="join-room" aria-labelledby="join-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">GOT AN INVITE?</p><h2 id="join-title">Join a room</h2></div>
                <span className="join-icon" aria-hidden="true">↗</span>
              </div>
              <p className="join-description">Enter the six-character code your host shared with you.</p>
              <form className="join-form" onSubmit={(event) => { event.preventDefault(); join(); }}>
                <label className="sr-only" htmlFor="room-code">Room code</label>
                <input id="room-code" value={joinCode} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="ABC123" onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                <button type="submit" className="btn small" disabled={busy || connectionStatus !== "connected"}>{busy ? "Joining…" : connectionStatus !== "connected" ? "Offline" : "Join"}</button>
              </form>
              {msg && msgTarget === "join" && <p className="home-notice" role="alert">{msg}</p>}
            </section>

            <section className="rules-promo" aria-label="How to play">
              <div className="promo-art-ball" aria-hidden="true">✦</div>
              <p className="section-eyebrow">YOUR TEAM. YOUR TACTICS.</p>
              <h2>Every bid<br />builds a dream.</h2>
              <p>Pick your squad, manage your purse, and take the trophy.</p>
              <button type="button" className="promo-link" onClick={() => scrollTo("create-room")}>Get started <span aria-hidden="true">→</span></button>
            </section>
          </aside>
        </div>
      </main>

      <footer className="home-footer"><span>PLAY AUCTION</span><span>Built for cricket fans, played with friends.</span><a href="#home">Back to top ↑</a></footer>
      <nav className="mobile-nav" aria-label="Quick navigation">
        <button type="button" className="active" onClick={() => scrollTo("home")}><span aria-hidden="true">⌂</span>Home</button>
        <button type="button" onClick={() => scrollTo("live-rooms")}><span aria-hidden="true">ϟ</span>Auctions</button>
        <button type="button" onClick={() => scrollTo("teams")}><span aria-hidden="true">♟</span>Teams</button>
        <button type="button" onClick={() => scrollTo("join-room")}><span aria-hidden="true">↗</span>Join</button>
        <button type="button" onClick={() => scrollTo("create-room")}><span aria-hidden="true">☰</span>More</button>
      </nav>
    </div>
  );
}
