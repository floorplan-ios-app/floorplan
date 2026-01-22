import React, { useEffect, useState } from "react";
import { apiHealth } from "../util/api";

export function App() {
  const [health, setHealth] = useState<string>("(loading)");

  useEffect(() => {
    apiHealth().then(setHealth).catch((e) => setHealth(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <h1>Floor Plan Tracer (Web)</h1>
      <p>API health: {health}</p>
      <p>This is a scaffold. Next: implement viewer/editor surface.</p>
    </div>
  );
}
