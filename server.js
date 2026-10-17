'use strict';
// ATLAS — Name, Place, Animal, Thing. The server owns rooms, timers and scoring,
// so nobody can peek at answers or fiddle with the clock from their browser.

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.use(express.static(PUBLIC));
app.get('/r/:code', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/healthz', (_req, res) => res.send('ok'));

// ---------- constants ----------
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NOTEBOOKS = ['ruled', 'fourline', 'plain', 'graph', 'crumpled'];
const FONTS = ['kalam', 'gochi', 'schoolbell', 'indie', 'shadows', 'reenie', 'patrick', 'caveat'];
const INKS = ['blue', 'black', 'pencil', 'green', 'purple'];
const COVERS = ['brown', 'blue', 'maroon', 'green', 'yellow'];
const PICK_MS = 15000;
const RECONNECT_GRACE_MS = 8000;
const MAX_ROOMS = 3000;
const NAME_LEN = 16;
const ANSWER_LEN = 30;

const rooms = new Map();

// ---------- helpers ----------
const randId = (n) => crypto.randomBytes(n).toString('base64url').slice(0, n);
// Answers are words: letters A to Z and spaces only ("New Delhi" is fine, "B2" is not).
const cleanAnswer = (s) => clampStr(String(s ?? '').replace(/[^A-Za-z ]/g, ''), ANSWER_LEN);
const clampStr = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const activePlayers = (room) => room.players.filter((p) => !p.left);
const getPlayer = (room, id) => room.players.find((p) => p.id === id && !p.left);

function newCode() {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  let c;
  do {
    c = '';
    for (let i = 0; i < 4; i++) c += L[crypto.randomInt(L.length)];
  } while (rooms.has(c));
  return c;
}

function cleanProfile(p = {}, prev = {}) {
  return {
    notebook: oneOf(p.notebook, NOTEBOOKS, prev.notebook || 'ruled'),
    font: oneOf(p.font, FONTS, prev.font || 'kalam'),
    ink: oneOf(p.ink, INKS, prev.ink || 'blue'),
    cover: oneOf(p.cover, COVERS, prev.cover || 'brown'),
  };
}

function defaultSettings() {
  return {
    rounds: 5,
    maxPlayers: 8,
    countdown: 10,
    roundLimit: 90,
    scoring: 'simple',
    stopBonus: false,
    columns: ['Name', 'Place', 'Animal', 'Thing'],
    excluded: ['Q', 'X', 'Z'],
  };
}

function cleanSettings(s, prev, playerCount) {
  const out = { ...prev };
  if (!s || typeof s !== 'object') return out;
  if ([3, 5, 8, 10, 15, 20].includes(s.rounds)) out.rounds = s.rounds;
  if (Number.isInteger(s.maxPlayers) && s.maxPlayers >= 2 && s.maxPlayers <= 12) {
    out.maxPlayers = Math.max(s.maxPlayers, playerCount);
  }
  if ([5, 10, 15, 20].includes(s.countdown)) out.countdown = s.countdown;
  if ([60, 90, 120, 180].includes(s.roundLimit)) out.roundLimit = s.roundLimit;
  if (['simple', 'classic'].includes(s.scoring)) out.scoring = s.scoring;
  if (typeof s.stopBonus === 'boolean') out.stopBonus = s.stopBonus;
  if (Array.isArray(s.columns)) {
    const cols = [];
    for (const c of s.columns.slice(0, 20)) {
      const t = clampStr(c, 16);
      if (t && !cols.some((x) => x.toLowerCase() === t.toLowerCase())) cols.push(t);
    }
    if (cols.length >= 2 && cols.length <= 10) out.columns = cols;
  }
  if (Array.isArray(s.excluded)) {
    const ex = [...new Set(s.excluded.filter((l) => ALPHABET.includes(l)))];
    if (ex.length <= 20) out.excluded = ex;
  }
  return out;
}

function uniqueName(room, name) {
  const taken = new Set(activePlayers(room).map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, NAME_LEN - 3)} ${i}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

// ---------- answer matching ----------
// "Bangalore", " bangalore." and "BANGA-LORE" are the same answer; so are "Bat" and "Bats".
function normalize(s) {
  let t = String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t;
}

// Same place, different name: old and new names, local and English names.
// The first name in each list is the one shown in "same as …" notes.
const ALIASES = [
  ['Bangalore', 'Bengaluru', 'Bengalooru'],
  ['Mumbai', 'Bombay'],
  ['Chennai', 'Madras'],
  ['Kolkata', 'Calcutta'],
  ['Pune', 'Poona'],
  ['Mysore', 'Mysuru'],
  ['Mangalore', 'Mangaluru'],
  ['Belgaum', 'Belagavi'],
  ['Hubli', 'Hubballi'],
  ['Gulbarga', 'Kalaburagi'],
  ['Bellary', 'Ballari'],
  ['Shimoga', 'Shivamogga'],
  ['Tumkur', 'Tumakuru'],
  ['Bijapur', 'Vijayapura'],
  ['Trivandrum', 'Thiruvananthapuram'],
  ['Cochin', 'Kochi'],
  ['Calicut', 'Kozhikode'],
  ['Trichur', 'Thrissur'],
  ['Alleppey', 'Alappuzha'],
  ['Quilon', 'Kollam'],
  ['Cannanore', 'Kannur'],
  ['Trichy', 'Tiruchirappalli', 'Tiruchi'],
  ['Tanjore', 'Thanjavur'],
  ['Ooty', 'Udhagamandalam', 'Ootacamund'],
  ['Pondicherry', 'Puducherry', 'Pondy'],
  ['Conjeevaram', 'Kanchipuram', 'Kanchi'],
  ['Tuticorin', 'Thoothukudi'],
  ['Vizag', 'Visakhapatnam', 'Vishakhapatnam', 'Waltair'],
  ['Rajahmundry', 'Rajamahendravaram'],
  ['Baroda', 'Vadodara'],
  ['Benaras', 'Varanasi', 'Banaras', 'Kashi'],
  ['Allahabad', 'Prayagraj'],
  ['Gurgaon', 'Gurugram'],
  ['Delhi', 'Dilli', 'New Delhi'],
  ['Cawnpore', 'Kanpur'],
  ['Simla', 'Shimla'],
  ['Mussoorie', 'Masuri'],
  ['Jubbulpore', 'Jabalpur'],
  ['Gauhati', 'Guwahati'],
  ['Orissa', 'Odisha'],
  ['Burma', 'Myanmar'],
  ['Ceylon', 'Sri Lanka', 'Srilanka', 'Lanka'],
  ['Siam', 'Thailand'],
  ['Persia', 'Iran'],
  ['Holland', 'Netherlands', 'The Netherlands'],
  ['Turkey', 'Turkiye'],
  ['Swaziland', 'Eswatini'],
  ['Czech Republic', 'Czechia'],
  ['Peking', 'Beijing'],
  ['Saigon', 'Ho Chi Minh City', 'Ho Chi Minh'],
  ['Rangoon', 'Yangon'],
  ['Dacca', 'Dhaka'],
  ['America', 'USA', 'US', 'United States', 'United States of America'],
  ['Britain', 'UK', 'United Kingdom', 'Great Britain'],
  ['UAE', 'United Arab Emirates', 'Emirates'],
  ['Hindustan', 'India', 'Bharat'],
];

// Compares two normalized words: equal, or a small slip. Swapped neighbours count as one slip,
// so "Banaglore" = "Bangalore" and "Benglauru" = "Bengaluru". Longer words may have two slips.
function slips(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
function closeEnough(a, b) {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 6) return false;
  const max = len >= 8 ? 2 : 1;
  return slips(a, b, max) <= max;
}

const ALIAS_OF = new Map(); // normalized spelling -> display name of the place
for (const names of ALIASES) for (const n of names) if (!ALIAS_OF.has(normalize(n))) ALIAS_OF.set(normalize(n), names[0]);

// Which place this is, if we know it by another name (spelling slips allowed).
function placeOf(n) {
  if (ALIAS_OF.has(n)) return ALIAS_OF.get(n);
  for (const [k, v] of ALIAS_OF) if (closeEnough(k, n)) return v;
  return null;
}

const sameAnswer = (a, b) => closeEnough(a.n, b.n) || (a.place && a.place === b.place);

function scoreRound(r) {
  const letter = r.letter.toLowerCase();
  const pids = r.participants;
  const rows = pids.map((pid) => ({ pid, cells: [], bonus: 0, total: 0 }));

  r.columns.forEach((_col, ci) => {
    const entries = [];
    for (const row of rows) {
      const text = cleanAnswer(r.answers[row.pid]?.[ci]);
      const n = normalize(text);
      let status = 'ok';
      if (!text) status = 'blank';
      else if (!n.startsWith(letter)) status = 'wrong';
      row.cells[ci] = { text, status, points: 0, key: null, votes: 0, backVotes: 0, givenBack: false, sameAs: null };
      if (status === 'ok') entries.push({ row, n, place: placeOf(n) });
    }

    // The class can vote to give a cut answer back: it then stands on its own.
    const backFor = (r.appeals && r.appeals[ci]) || {};
    const groups = [];
    for (const e of entries) {
      const voters = (backFor[e.row.pid] || []).filter((v) => v !== e.row.pid && pids.includes(v));
      e.row.cells[ci].backVotes = voters.length;
      if (voters.length > (pids.length - 1) / 2) {
        e.row.cells[ci].givenBack = true;
        groups.push([e]);
        continue;
      }
      const g = groups.find((grp) => !grp[0].row.cells[ci].givenBack && grp.some((x) => sameAnswer(x, e)));
      if (g) g.push(e);
      else groups.push([e]);
    }

    // Say why something was cut when the spellings differ ("Bengaluru" = "Bangalore").
    for (const g of groups) {
      for (const e of g) {
        const other = g.find((x) => x !== e && x.n !== e.n);
        if (other) e.row.cells[ci].sameAs = other.row.cells[ci].text;
      }
    }

    const votesFor = r.challenges[ci] || {};
    const live = [];
    for (const g of groups) {
      const key = g[0].row.cells[ci].givenBack ? `${g[0].n}~${g[0].row.pid}` : g[0].n;
      const authors = new Set(g.map((e) => e.row.pid));
      const others = pids.filter((id) => !authors.has(id));
      const votes = (votesFor[key] || []).filter((v) => !authors.has(v) && pids.includes(v)).length;
      const rejected = others.length > 0 && votes > others.length / 2;
      for (const e of g) {
        e.row.cells[ci].key = key;
        e.row.cells[ci].votes = votes;
        if (rejected) e.row.cells[ci].status = 'rejected';
      }
      if (!rejected) live.push(g);
    }

    const validCount = live.reduce((a, g) => a + g.length, 0);
    for (const g of live) {
      for (const e of g) {
        const c = e.row.cells[ci];
        if (g.length > 1) {
          c.status = 'dup';
          c.points = r.scoring === 'classic' ? 5 : 0;
        } else {
          c.status = 'unique';
          c.points = r.scoring === 'classic' && validCount === 1 && pids.length > 1 ? 20 : 10;
        }
      }
    }
  });

  for (const row of rows) {
    if (r.stopBonus && r.stopBy === row.pid) row.bonus = 5;
    row.total = row.cells.reduce((a, c) => a + c.points, 0) + row.bonus;
  }
  return rows;
}

// ---------- room lifecycle ----------
function createRoom() {
  const room = {
    code: newCode(),
    hostId: null,
    players: [],
    settings: defaultSettings(),
    phase: 'lobby', // lobby | picking | writing | countdown | reveal | ended
    round: null,
    history: [],
    used: [],
    pickerCursor: -1,
    timer: null,
    deadline: 0,
    lastActive: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

function clearTimer(room) {
  clearTimeout(room.timer);
  room.timer = null;
  room.deadline = 0;
}

function setTimer(room, ms, fn) {
  clearTimer(room);
  room.deadline = Date.now() + ms;
  room.timer = setTimeout(() => {
    room.timer = null;
    if (!rooms.has(room.code)) return;
    fn();
    broadcast(room);
  }, ms);
}

function ensureHost(room) {
  const host = getPlayer(room, room.hostId);
  if (host && host.connected) return;
  const next = activePlayers(room).find((p) => p.connected) || (host ? null : activePlayers(room)[0]);
  if (next) room.hostId = next.id;
}

const lettersLeft = (room) => ALPHABET.filter((l) => !room.settings.excluded.includes(l) && !room.used.includes(l));

function nextPicker(room) {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (room.pickerCursor + i) % n;
    const p = room.players[idx];
    if (!p.left && p.connected) {
      room.pickerCursor = idx;
      return p;
    }
  }
  return null;
}

function startPicking(room) {
  const picker = nextPicker(room);
  if (!picker) return;
  room.round = {
    n: room.history.length + 1,
    letter: null,
    pickerId: picker.id,
    participants: activePlayers(room).map((p) => p.id),
    columns: [...room.settings.columns],
    scoring: room.settings.scoring,
    stopBonus: room.settings.stopBonus,
    answers: {},
    done: {},
    stopBy: null,
    challenges: {},
    appeals: {},
    names: {},
  };
  room.phase = 'picking';
  setTimer(room, PICK_MS, () => chooseLetter(room, randomLetter(room)));
}

function randomLetter(room) {
  const left = lettersLeft(room);
  return left[crypto.randomInt(left.length)];
}

function chooseLetter(room, letter) {
  const r = room.round;
  r.letter = letter;
  room.used.push(letter);
  for (const pid of r.participants) r.answers[pid] = r.columns.map(() => '');
  room.phase = 'writing';
  setTimer(room, room.settings.roundLimit * 1000, () => finishRound(room));
}

function finishRound(room) {
  clearTimer(room);
  const r = room.round;
  for (const pid of r.participants) {
    const p = room.players.find((x) => x.id === pid);
    r.names[pid] = { name: p.name, font: p.font, ink: p.ink };
  }
  const picker = room.players.find((x) => x.id === r.pickerId);
  r.pickerName = picker ? picker.name : '';
  room.history.push(r);
  room.round = null;
  room.phase = 'reveal';
}

function maybeFinishEarly(room) {
  if (room.phase !== 'countdown') return;
  const r = room.round;
  const waiting = r.participants.filter((pid) => {
    const p = getPlayer(room, pid);
    return p && p.connected && !r.done[pid];
  });
  if (waiting.length === 0) finishRound(room);
}

function gameOver(room) {
  return room.history.length >= room.settings.rounds || lettersLeft(room).length === 0;
}

function resetToLobby(room) {
  clearTimer(room);
  room.phase = 'lobby';
  room.round = null;
  room.history = [];
  room.used = [];
  room.pickerCursor = -1;
}

// ---------- state sent to each player ----------
function buildShared(room) {
  const totals = {};
  const history = room.history.map((r) => {
    const rows = scoreRound(r);
    for (const row of rows) totals[row.pid] = (totals[row.pid] || 0) + row.total;
    return {
      n: r.n,
      letter: r.letter,
      pickerName: r.pickerName,
      columns: r.columns,
      stopBy: r.stopBy,
      challenges: r.challenges,
      appeals: r.appeals,
      rows: rows.map((row) => ({ ...row, ...r.names[row.pid] })),
    };
  });

  const r = room.round;
  const players = activePlayers(room).map((p) => ({
    id: p.id,
    name: p.name,
    notebook: p.notebook,
    font: p.font,
    ink: p.ink,
    cover: p.cover,
    connected: p.connected,
    score: totals[p.id] || 0,
    playing: r ? r.participants.includes(p.id) : true,
    filled: r && r.answers[p.id] ? r.answers[p.id].filter((a) => a.trim()).length : 0,
    done: r ? !!r.done[p.id] : false,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    players,
    history,
    used: room.used,
    lettersLeft: lettersLeft(room),
    deadline: room.deadline,
    round: r && {
      n: r.n,
      letter: r.letter,
      pickerId: r.pickerId,
      columns: r.columns,
      stopBy: r.stopBy,
      participants: r.participants,
    },
  };
}

function broadcast(room) {
  room.lastActive = Date.now();
  const shared = buildShared(room);
  const serverNow = Date.now();
  for (const p of room.players) {
    if (!p.connected || !p.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;
    const r = room.round;
    sock.emit('state', {
      ...shared,
      you: p.id,
      serverNow,
      myDraft: r && r.answers[p.id] ? r.answers[p.id] : null,
      myDone: r ? !!r.done[p.id] : false,
    });
  }
}

// ---------- sockets ----------
function attach(socket, room, p) {
  if (p.socketId && p.socketId !== socket.id) {
    const old = io.sockets.sockets.get(p.socketId);
    if (old) {
      old.data = {};
      old.disconnect(true);
    }
  }
  p.socketId = socket.id;
  p.connected = true;
  socket.data = { code: room.code, pid: p.id };
  socket.join(room.code);
}

function ctx(socket) {
  const room = rooms.get(socket.data?.code);
  if (!room) return {};
  const p = getPlayer(room, socket.data.pid);
  if (!p) return {};
  return { room, p };
}

const safeAck = (ack) => (typeof ack === 'function' ? ack : () => {});

io.on('connection', (socket) => {
  socket.on('create', (data, ack) => {
    ack = safeAck(ack);
    const name = clampStr(data?.name, NAME_LEN);
    if (!name) return ack({ error: 'Write your name on the label first.' });
    if (rooms.size >= MAX_ROOMS) return ack({ error: 'Too many games running right now. Try again in a bit.' });
    const room = createRoom();
    const p = { id: randId(6), token: randId(16), name, ...cleanProfile(data?.profile), connected: true, left: false };
    room.players.push(p);
    room.hostId = p.id;
    attach(socket, room, p);
    ack({ ok: true, code: room.code, token: p.token });
    broadcast(room);
  });

  socket.on('join', (data, ack) => {
    ack = safeAck(ack);
    const code = clampStr(data?.code, 8).toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ error: 'That room doesn’t exist anymore. Start a new one.' });
    const token = clampStr(data?.token, 40);
    const name = clampStr(data?.name, NAME_LEN);

    let p = token ? room.players.find((x) => x.token === token && !x.left) : null;
    // Closed the tab by mistake? Writing the same name again gets your seat (and marks) back.
    if (!p && name) {
      p = room.players.find((x) => !x.left && !x.connected && x.name.toLowerCase() === name.toLowerCase());
      if (p) p.token = randId(16);
    }
    if (!p) {
      if (!name) return ack({ error: 'Write your name on the label first.' });
      if (activePlayers(room).length >= room.settings.maxPlayers) return ack({ error: 'This room is full.' });
      p = { id: randId(6), token: randId(16), name: uniqueName(room, name), connected: true, left: false };
      Object.assign(p, cleanProfile(data?.profile));
      room.players.push(p);
    } else if (data?.profile) {
      Object.assign(p, cleanProfile(data.profile, p));
    }
    attach(socket, room, p);
    ensureHost(room);
    ack({ ok: true, code: room.code, token: p.token });
    broadcast(room);
  });

  socket.on('profile', (data) => {
    const { room, p } = ctx(socket);
    if (!room) return;
    Object.assign(p, cleanProfile(data, p));
    broadcast(room);
  });

  socket.on('settings', (data) => {
    const { room, p } = ctx(socket);
    if (!room || room.hostId !== p.id || room.phase !== 'lobby') return;
    room.settings = cleanSettings(data, room.settings, activePlayers(room).length);
    broadcast(room);
  });

  socket.on('start', (_d, ack) => {
    ack = safeAck(ack);
    const { room, p } = ctx(socket);
    if (!room || room.hostId !== p.id || room.phase !== 'lobby') return;
    if (activePlayers(room).filter((x) => x.connected).length < 2) return ack({ error: 'You need at least 2 players.' });
    if (lettersLeft(room).length === 0) return ack({ error: 'All letters are excluded. Allow a few back.' });
    resetToLobby(room);
    startPicking(room);
    broadcast(room);
  });

  socket.on('pickLetter', (letter) => {
    const { room, p } = ctx(socket);
    if (!room || room.phase !== 'picking' || room.round.pickerId !== p.id) return;
    if (!lettersLeft(room).includes(letter)) return;
    chooseLetter(room, letter);
    broadcast(room);
  });

  socket.on('draft', (answers) => {
    const { room, p } = ctx(socket);
    if (!room || !['writing', 'countdown'].includes(room.phase)) return;
    const r = room.round;
    if (!r.answers[p.id] || r.done[p.id] || !Array.isArray(answers)) return;
    const before = r.answers[p.id].filter((a) => a).length;
    r.answers[p.id] = r.columns.map((_c, i) => cleanAnswer(answers[i]));
    if (r.answers[p.id].filter((a) => a).length !== before) broadcast(room);
  });

  // First person with every column filled shouts STOP; after that the same button means "I'm done".
  socket.on('stop', (answers) => {
    const { room, p } = ctx(socket);
    if (!room || !['writing', 'countdown'].includes(room.phase)) return;
    const r = room.round;
    if (!r.answers[p.id] || r.done[p.id]) return;
    if (Array.isArray(answers)) r.answers[p.id] = r.columns.map((_c, i) => cleanAnswer(answers[i]));
    if (room.phase === 'writing') {
      if (!r.answers[p.id].every((a) => a)) return;
      r.stopBy = p.id;
      r.done[p.id] = true;
      room.phase = 'countdown';
      setTimer(room, room.settings.countdown * 1000, () => finishRound(room));
    } else {
      r.done[p.id] = true;
    }
    maybeFinishEarly(room);
    broadcast(room);
  });

  socket.on('challenge', (data) => {
    const { room, p } = ctx(socket);
    if (!room || room.phase !== 'reveal') return;
    const r = room.history[room.history.length - 1];
    const ci = Number(data?.ci);
    const key = String(data?.key || '');
    if (!r || !Number.isInteger(ci) || ci < 0 || ci >= r.columns.length || !r.participants.includes(p.id)) return;
    const rows = scoreRound(r);
    if (!rows.some((row) => row.cells[ci].key === key)) return;
    const mine = rows.find((row) => row.pid === p.id);
    if (mine && mine.cells[ci].key === key) return; // can't object to your own answer
    r.challenges[ci] = r.challenges[ci] || {};
    const voters = new Set(r.challenges[ci][key] || []);
    if (voters.has(p.id)) voters.delete(p.id);
    else voters.add(p.id);
    r.challenges[ci][key] = [...voters];
    broadcast(room);
  });

  // "Give it back": vote that a cut answer was cut unfairly (e.g. two different words the matcher joined).
  socket.on('appeal', (data) => {
    const { room, p } = ctx(socket);
    if (!room || room.phase !== 'reveal') return;
    const r = room.history[room.history.length - 1];
    const ci = Number(data?.ci);
    const pid = String(data?.pid || '');
    if (!r || !Number.isInteger(ci) || ci < 0 || ci >= r.columns.length) return;
    if (!r.participants.includes(p.id) || !r.participants.includes(pid) || pid === p.id) return;
    const row = scoreRound(r).find((x) => x.pid === pid);
    if (!row || !(row.cells[ci].status === 'dup' || row.cells[ci].givenBack)) return;
    r.appeals[ci] = r.appeals[ci] || {};
    const voters = new Set(r.appeals[ci][pid] || []);
    if (voters.has(p.id)) voters.delete(p.id);
    else voters.add(p.id);
    r.appeals[ci][pid] = [...voters];
    broadcast(room);
  });

  socket.on('next', () => {
    const { room, p } = ctx(socket);
    if (!room || room.hostId !== p.id || room.phase !== 'reveal') return;
    if (gameOver(room)) room.phase = 'ended';
    else startPicking(room);
    broadcast(room);
  });

  socket.on('endGame', () => {
    const { room, p } = ctx(socket);
    if (!room || room.hostId !== p.id || ['lobby', 'ended'].includes(room.phase)) return;
    if (room.round && room.phase !== 'picking') finishRound(room);
    clearTimer(room);
    room.round = null;
    room.phase = room.history.length ? 'ended' : 'lobby';
    broadcast(room);
  });

  socket.on('playAgain', () => {
    const { room, p } = ctx(socket);
    if (!room || room.hostId !== p.id || room.phase !== 'ended') return;
    resetToLobby(room);
    broadcast(room);
  });

  socket.on('leave', () => {
    const { room, p } = ctx(socket);
    if (!room) return;
    p.left = true;
    p.connected = false;
    socket.leave(room.code);
    socket.data = {};
    afterPlayerGone(room, p);
  });

  socket.on('disconnect', () => {
    const { room, p } = ctx(socket);
    if (!room || p.socketId !== socket.id) return;
    p.connected = false;
    broadcast(room);
    setTimeout(() => {
      if (!rooms.has(room.code) || p.connected) return;
      afterPlayerGone(room, p);
    }, RECONNECT_GRACE_MS);
  });
});

function afterPlayerGone(room, p) {
  ensureHost(room);
  if (room.phase === 'picking' && room.round.pickerId === p.id) {
    chooseLetter(room, randomLetter(room));
  }
  maybeFinishEarly(room);
  broadcast(room);
}

// Rooms nobody has touched for 45 minutes are thrown away.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => p.connected);
    if (!anyone && now - room.lastActive > 45 * 60 * 1000) {
      clearTimer(room);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`ATLAS is running on http://localhost:${PORT}`));
