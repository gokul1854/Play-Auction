# Deploying the auction app

The app runs as one Node service. It serves the game screens and handles real-time play.

## 1. Put the code on GitHub
1. Create a new empty repository on github.com (for example `play-auction`).
2. In the `auction-app` folder, run:
   ```
   git init
   git add .
   git commit -m "Initial auction app"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/play-auction.git
   git push -u origin main
   ```

## 2. Create the service on Render
1. Sign up at render.com with your GitHub account.
2. Click **New → Blueprint**, choose your `play-auction` repository, and confirm. Render reads `render.yaml` and sets up everything.
3. Wait for the build to finish (a few minutes). The live link looks like `https://play-auction.onrender.com`.

## 3. Share it
Send the link to your friends. Anyone who opens it can create a room, or join one with a 6-character code.

## Notes
- **Free plan sleeps** after about 15 minutes with no visitors. The first load after that can take around 30 seconds. Upgrade the plan to keep it awake.
- **Rooms are in memory.** A restart or redeploy clears all rooms. Fine for playing a session; saving rooms needs a database (planned as a later step).
- **Single instance only.** Keep the service at one instance, since rooms live in that process.
- To run locally: `npm install`, `npm run build`, `npm start`, then open http://localhost:3000.

## Adding a full player list
1. Copy `tools/players-template.csv` and fill in one row per player: `name,country,role,category,pool`.
   - role: Batter, Bowler, All-rounder or Keeper
   - category: Legend, Marquee, Capped or Uncapped
   - pool: IPL, International, Test or Legends
2. Check the file without changing anything: `node tools/import-players.mjs players.csv --min 500 --dry-run`
3. When it passes, load it: `node tools/import-players.mjs players.csv --min 500`
4. Commit and push the updated `server/data/players.json`, and Render will redeploy.

The importer refuses the file if any row is invalid or if a category has fewer than the minimum, so a short list is never loaded by mistake.
