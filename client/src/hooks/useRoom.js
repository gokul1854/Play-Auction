import { useCallback, useEffect, useRef, useState } from "react";
import { socket, send, getName } from "../socket.js";

// Subscribes to a room's live state. Rejoins automatically after a reconnect.
export function useRoom(code) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [kicked, setKicked] = useState(false);
  const offset = useRef(0); // server clock minus local clock, so timers agree

  useEffect(() => {
    const join = () => {
      const name = getName();
      if (code && name) send("room:join", { code, name });
    };
    const onState = (s) => {
      if (!s || s.code !== code) return setState(null);
      offset.current = s.serverNow - Date.now();
      setState(s);
    };
    const onConnect = () => { setConnected(true); join(); };
    const onDisconnect = () => setConnected(false);
    const onKicked = () => { setKicked(true); setState(null); };

    socket.on("room:state", onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:kicked", onKicked);
    join(); // covers navigating here from another screen
    return () => {
      socket.off("room:state", onState);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:kicked", onKicked);
    };
  }, [code]);

  const now = useCallback(() => Date.now() + offset.current, []);
  return { state, connected, now, kicked };
}
