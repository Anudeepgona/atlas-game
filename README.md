# ATLAS 🌍

Name · Place · Animal · Thing, the game from the back bench, now online.
Make a room, share the link, pick a letter, write fast, shout **STOP!**

## Run it on your computer

```bash
npm install
npm start
```

Open http://localhost:3000. To try it with friends on the same Wi-Fi, they can open `http://<your-computer's-IP>:3000`.

## Put it online (free) so anyone can join

### Render (easiest)
1. Push this folder to a GitHub repository.
2. Go to https://render.com → **New → Web Service** → pick the repo.
3. Settings: Runtime **Node**, Build command `npm install`, Start command `npm start`, Instance type **Free**.
4. Deploy. You'll get a link like `https://atlas-xxxx.onrender.com`. That's your game.

The `render.yaml` in this folder lets you use **New → Blueprint** instead, which fills these settings in for you.

Free Render apps go to sleep after 15 minutes with nobody playing. The first person to open the link after that waits about 30 seconds while it wakes up. Rooms live in memory, so a restart or redeploy ends any games in progress.

### Railway / Fly.io / any Node host
It's a plain Node 18+ app. Run `npm install`, then `npm start`. It listens on `PORT` (default 3000). It needs WebSockets, which all of these support.

## How the game works

- **Lobby:** the host (called the *Monitor*) shares the link, sets rounds, columns, timers and skipped letters.
- **Picking:** turns rotate. The picker watches the alphabet flip and hits **STOP!**, or taps a letter on the chart. After 15 seconds, a random letter is picked.
- **Writing:** fill every column to unlock **STOP!** Everyone else then gets the countdown (10 s by default). There's also a time limit per round (90 s by default) so one slow friend can't stall the game.
- **Marks** (shown in red pen):
  - The same answer as anyone else is cut.
  - A unique answer gets 10. Blanks and wrong letters get 0.
  - Classic mode is optional: same = 5, and 20 if you were the only one to write anything in that column.
  - An optional +5 goes to whoever shouts STOP.
- **Answers** take letters A to Z and spaces only ("New Delhi" works; digits and symbols are dropped as you type).
- **Typing:** the first box is focused when the letter appears. Enter (or *Next* on a phone keyboard) jumps to the next empty box, and the STOP button stays pinned on screen once you've filled everything.
- **Matching** ignores case, spaces and punctuation, and plurals match ("Bats" = "Bat"). Spelling slips in words of 6+ letters count as the same word, including swapped letters ("Banaglore" = "Bangalore"). Old and new place names match too ("Bengaluru" = "Bangalore", "Bombay" = "Mumbai", "Madras" = "Chennai", "Ceylon" = "Sri Lanka", …). The list is `ALIASES` in `server.js`. A cut answer shows why it was cut ("= Bangalore?").
- **Class court:** the computer only *suggests* marks; the players decide. During the reveal every answer has a vote chip:
  - **✗ cut?** on a live answer: if more than half of the *other* players agree, it's cut.
  - **↩ give back?** on a cut answer, for when two different answers got matched (Karan ≠ Kiran): if more than half of the others agree, it stands on its own and gets its marks back.
  - Marks update as soon as the vote passes, and you can tap again to take your vote back. A yellow "Class court is open!" panel above the marks explains this every round.
- **The notebook:** older rounds fold into one line (letter plus everyone's marks), and you can tap to open them. Each new round is written under the last one, with a double line drawn across the page in between. Everyone sees it in their own notebook (ruled, four-line, plain, maths squares, or a crumpled paper-ball page), with each friend's answers in that friend's handwriting and pen colour.
- **Small screens:** if the marks table doesn't fit, it switches to one block per column, so there's never a sideways scroll.
- **Report card** at the end, with ranks, grades and cheeky remarks, signed by the class teacher, S. Radhakrishnan.
- **Leaving and ending:** anyone can leave at any time; their earlier answers stay in the notebook. Only the Monitor (whoever made the room) can end the game early. If the Monitor leaves, the next player takes over so the game never gets stuck. *Play again* goes back to the lobby.

### Edge cases handled
- If you refresh or your connection drops mid-round, your typed answers are kept and get submitted when time runs out.
- Closed the tab by mistake? Join again with the same name and you get your seat and marks back.
- Someone joining mid-round watches that round and plays from the next one.
- If the Monitor leaves, the next player becomes Monitor. If the picker leaves, a random letter is picked.
- When everyone has pressed *I'm done*, the countdown ends early.
- Used letters can't be picked again. The game ends when the letters or rounds run out.
- Duplicate names get a number ("Deepu 2"). Rooms are capped at the max-players setting.
- Answers stay on the server until the reveal, so nobody can peek with browser tools.
- Empty rooms are cleaned up after 45 minutes.

## Files
- `server.js`: rooms, turns, timers and scoring (Express + Socket.IO).
- `public/index.html`, `public/style.css`, `public/app.js`: the notebook UI. No build step.
