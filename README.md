# Play Auction

A real-time cricket auction game for playing with friends. Create an auction room, share its six-character code, and manage the auction together in your browser.

## Features

- Create and join multiplayer rooms
- Live room updates over Socket.IO
- Cricket player pools, team squads, and auction purses
- Auction timers, settings, and in-room chat

## Requirements

- Node.js 22 or newer
- npm

## Run locally

From the project root:

```sh
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For frontend development with Vite, install the client dependencies and run the server and client in separate terminals:

```sh
npm run dev:server
```

```sh
npm --prefix client install
npm --prefix client run dev
```

Open the Vite URL shown in the client terminal. Socket.IO traffic is proxied to the local Node server on port 3000.

## Tests

```sh
npm test
```

## Deploy

The app needs a Node.js server for multiplayer rooms and real-time play. The included Render Blueprint deploys the frontend and server together. See [DEPLOY.md](DEPLOY.md) for GitHub and Render setup steps.

Rooms are held in memory, so they are cleared when the server restarts or redeploys. Run a single server instance; multiple instances do not share room state.