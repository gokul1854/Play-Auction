import { useEffect, useState } from "react";
import Home from "./screens/Home.jsx";
import Room from "./screens/Room.jsx";

// Routes: "/" is Home, "/room/ABC123" is a room.
function parseRoute() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{6})\/?$/);
  return match ? { page: "room", code: match[1].toUpperCase() } : { page: "home" };
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(path) {
    window.history.pushState({}, "", path);
    setRoute(parseRoute());
  }

  return route.page === "room"
    ? <Room code={route.code} navigate={navigate} />
    : <Home navigate={navigate} />;
}
