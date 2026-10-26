import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, forward Socket.IO traffic to the Node server on port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
