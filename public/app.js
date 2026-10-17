(() => {
  'use strict';

  // ---------- constants ----------
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const PRESETS = ['Name', 'Place', 'Animal', 'Thing', 'Color', 'Fruit', 'Flower', 'Bird', 'Vegetable', 'Food', 'Movie', 'Actor', 'Cricketer', 'Brand', 'Profession', 'Body part', 'Sport', 'River', 'Famous person', 'Country'];
  const NOTEBOOKS = [
    { id: 'ruled', label: 'Ruled' },
    { id: 'fourline', label: 'Four-line' },
    { id: 'plain', label: 'Plain' },
    { id: 'graph', label: 'Maths squares' },
    { id: 'crumpled', label: 'Paper ball' },
  ];
  const FONTS = ['kalam', 'gochi', 'schoolbell', 'indie', 'shadows', 'reenie', 'patrick', 'caveat'];
  const INKS = [
    { id: 'blue', label: 'Blue pen', color: '#1c3c9c' },
    { id: 'black', label: 'Black pen', color: '#1f1f22' },
    { id: 'pencil', label: 'Pencil', color: '#5b6066' },
    { id: 'green', label: 'Green gel pen', color: '#17763a' },
    { id: 'purple', label: 'Purple gel pen', color: '#5a2a9c' },
  ];
  const COVERS = [
    { id: 'brown', label: 'Brown paper', color: '#c2925c' },
    { id: 'blue', label: 'Blue', color: '#3f6fb6' },
    { id: 'maroon', label: 'Maroon', color: '#8e2f3b' },
    { id: 'green', label: 'Green', color: '#3d7d4f' },
    { id: 'yellow', label: 'Yellow', color: '#d8a93a' },
  ];
  const GLOBE = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="#cfe6f7" stroke="#fff" stroke-width="4"/><path d="M6 32h52M32 6c-10 8-10 44 0 52M32 6c10 8 10 44 0 52" fill="none" stroke="#1f3f9a" stroke-width="3"/><path d="M18 20c6 2 8 8 4 12s2 10-4 10" fill="#66a85b"/><path d="M40 16c4 4 10 4 8 10s-6 4-8 0" fill="#66a85b"/></svg>';

  // ---------- small utils ----------
  const app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = (area) => ({
    get(k, d) { try { const v = area.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { area.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
    del(k) { try { area.removeItem(k); } catch { /* storage blocked */ } },
  });
  const ls = store(window.localStorage);
  const ss = store(window.sessionStorage);

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A kid's handwriting: every letter a little crooked, a bit bigger first letter, the word drifting off the line.
  function hw(text, seed, font, ink) {
    const r = rng(hash(seed + '|' + text));
    const tilt = (r() - 0.6) * 4;
    let drift = 0;
    const chars = [...String(text)].map((ch, i) => {
      if (ch === ' ') return '<span>&nbsp;</span>';
      const rot = (r() - 0.5) * 10;
      drift = Math.max(-2, Math.min(2, drift + (r() - 0.5) * 0.9));
      const y = (r() - 0.5) * 2.6 + drift;
      const sc = i === 0 ? 1.08 + r() * 0.14 : 0.9 + r() * 0.16;
      return `<span style="transform:translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(2)})">${esc(ch)}</span>`;
    }).join('');
    return `<span class="hw f-${font} i-${ink}" style="transform:rotate(${tilt.toFixed(1)}deg)">${chars}</span>`;
  }

  const quip = (list, seed) => list[hash(String(seed)) % list.length];

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- sounds (made on the fly, no files) ----------
  let muted = ls.get('atlas.muted', false);
  let ac = null;
  function audio() {
    if (muted) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, start, dur, type, vol) {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = a.currentTime + start;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  const sfx = {
    bell() { for (let i = 0; i < 16; i++) { tone(1568, i * 0.055, 0.08, 'triangle', 0.12); tone(2349, i * 0.055, 0.06, 'sine', 0.05); } },
    tick() { tone(1250, 0, 0.04, 'square', 0.035); },
    chime() { tone(784, 0, 0.3, 'triangle', 0.14); tone(1047, 0.13, 0.45, 'triangle', 0.14); },
    ding() { tone(988, 0, 0.3, 'triangle', 0.14); },
    flip() { tone(500 + Math.random() * 80, 0, 0.02, 'square', 0.015); },
  };
  document.addEventListener('pointerdown', () => audio(), { once: true });

  // ---------- profile & session ----------
  let profile = Object.assign(
    { name: '', subject: 'Atlas', std: "4th 'B'", notebook: 'ruled', font: FONTS[Math.floor(Math.random() * FONTS.length)], ink: 'blue', cover: 'brown' },
    ls.get('atlas.profile', {}),
  );
  const saveProfile = () => ls.set('atlas.profile', profile);
  const look = () => ({ notebook: profile.notebook, font: profile.font, ink: profile.ink, cover: profile.cover });
  saveProfile();

  const codeFromUrl = () => ((location.pathname.match(/^\/r\/([A-Za-z]{4,8})\/?$/) || [])[1] || '').toUpperCase() || null;
  let code = codeFromUrl();
  const tokenKey = (c) => 'atlas.token.' + c;

  let state = null;
  let clockOffset = 0;
  let mounted = '';
  let joining = false;
  const animated = new Set();
  const now = () => Date.now() + clockOffset;
  const me = () => state && state.players.find((p) => p.id === state.you);
  const isHost = () => state && state.hostId === state.you;
  const playerName = (id) => (state.players.find((p) => p.id === id) || {}).name || 'Someone';
  const roomLink = () => `${location.origin}/r/${code}`;

  // ---------- socket ----------
  const socket = io();
  socket.on('connect', () => {
    if (code && ss.get(tokenKey(code))) joinRoom();
    else render();
  });
  socket.on('disconnect', () => { if (state) toast('Connection lost. Reconnecting…'); });
  socket.on('state', onState);

  function joinRoom() {
    if (!code) return;
    if (!profile.name.trim() && !ss.get(tokenKey(code))) { toast('Write your name on the label first.'); return; }
    joining = true;
    socket.emit('join', { code, token: ss.get(tokenKey(code)), name: profile.name, profile: look() }, (res) => {
      joining = false;
      if (res.error) {
        toast(res.error);
        ss.del(tokenKey(code));
        if (/exist/.test(res.error)) {
          code = null;
          state = null;
          history.replaceState(null, '', '/');
        }
        render();
        return;
      }
      ss.set(tokenKey(res.code), res.token);
      render();
    });
    render();
  }

  function createRoom() {
    if (!profile.name.trim()) { toast('Write your name on the label first.'); document.getElementById('name')?.focus(); return; }
    socket.emit('create', { name: profile.name, profile: look() }, (res) => {
      if (res.error) return toast(res.error);
      code = res.code;
      ss.set(tokenKey(code), res.token);
      history.replaceState(null, '', '/r/' + code);
      render();
    });
  }

  function leaveRoom() {
    socket.emit('leave');
    if (code) ss.del(tokenKey(code));
    code = null;
    state = null;
    history.replaceState(null, '', '/');
    render();
  }

  function onState(s) {
    const before = state;
    clockOffset = s.serverNow - Date.now();
    state = s;
    if (before) {
      if (before.phase === 'writing' && s.phase === 'countdown') sfx.bell();
      else if (s.phase === 'reveal' && before.phase !== 'reveal') sfx.chime();
      else if (s.phase === 'writing' && before.phase === 'picking') sfx.ding();
      else if (s.phase === 'ended' && before.phase !== 'ended') sfx.chime();
    }
    render();
  }

  // ---------- DOM patching ----------
  function mount(name, html) {
    if (mounted === name) return false;
    app.innerHTML = html;
    mounted = name;
    return true;
  }
  function patch(id, html) {
    const el = document.getElementById(id);
    if (!el || el._h === html) return;
    el.innerHTML = html;
    el._h = html;
  }
  // Keeps existing blocks (and their running animations) and only adds or swaps what changed.
  function patchList(container, items) {
    const existing = new Map([...container.children].map((el) => [el.dataset.key, el]));
    let prev = null;
    for (const { key, html } of items) {
      let el = existing.get(key);
      if (!el || el._h !== html) {
        const n = document.createElement('div');
        n.dataset.key = key;
        n.innerHTML = html;
        n._h = html;
        if (el) el.replaceWith(n);
        el = n;
      }
      existing.delete(key);
      const want = prev ? prev.nextSibling : container.firstChild;
      if (want !== el) container.insertBefore(el, want);
      prev = el;
    }
    existing.forEach((el) => el.remove());
  }

  function render() {
    if (!code || !state) {
      if (code && (joining || ss.get(tokenKey(code)))) return renderLoading();
      return renderHome();
    }
    if (state.phase === 'lobby') return renderLobby();
    if (state.phase === 'ended') return renderEnded();
    return renderGame();
  }

  function renderLoading() {
    mount('loading', `<div class="wrap home"><div class="cover cover-${profile.cover}"><div class="title-atlas">ATLAS</div><p class="tagline">Opening your notebook…</p></div></div>`);
  }

  // ---------- shared bits ----------
  const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
  const pageTop = (left) => `<div class="page-top"><div>${left || ''}</div><span class="datebox">Date: <b>${today()}</b> &nbsp; Page No.: <b>${esc(code)}</b></span></div>`;

  const muteLabel = () => (muted ? '🔕<span class="lbl"> Sound off</span>' : '🔔<span class="lbl"> Sound on</span>');

  function topbar(extra) {
    return `<div class="topbar">
      <a class="logo" href="/" data-act="home">${GLOBE}<span>ATLAS</span></a>
      <div class="tools">
        ${extra || ''}
        <button class="chip-btn code-chip" data-act="copy" title="Copy the invite link">Room ${esc(code)} ⧉</button>
        <button class="chip-btn" data-act="mute" id="mute-btn" aria-label="Sound">${muteLabel()}</button>
        <button class="chip-btn" data-act="rules">Rules</button>
        <button class="chip-btn" data-act="leave">Leave</button>
      </div>
    </div>`;
  }

  function pickersHtml() {
    const dummies = ['Chintu', 'Pinky', 'Bablu', 'Munni', 'Golu', 'Sweety', 'Bunty', 'Dolly'];
    return `
      <h3>Choose your notebook</h3>
      <div class="opts">${NOTEBOOKS.map((n) => `
        <button class="opt" data-act="prof" data-k="notebook" data-v="${n.id}" aria-pressed="${profile.notebook === n.id}">
          <div class="nb nb-${n.id} mini-page"></div>${n.label}
        </button>`).join('')}</div>
      <h3>Your handwriting</h3>
      <div class="opts">${FONTS.map((f) => `
        <button class="opt" data-act="prof" data-k="font" data-v="${f}" aria-pressed="${profile.font === f}" aria-label="Handwriting style ${f}">
          ${hw(dummies[FONTS.indexOf(f)], f, f, profile.ink)}
        </button>`).join('')}</div>
      <h3>Your pen</h3>
      <div class="ink-dots">${INKS.map((i) => `<button class="ink-dot" style="background:${i.color}" data-act="prof" data-k="ink" data-v="${i.id}" aria-pressed="${profile.ink === i.id}" aria-label="${i.label}" title="${i.label}"></button>`).join('')}</div>
      <h3>Your cover</h3>
      <div class="cover-dots">${COVERS.map((c) => `<button class="cover-dot" style="background:${c.color}" data-act="prof" data-k="cover" data-v="${c.id}" aria-pressed="${profile.cover === c.id}" aria-label="${c.label} cover" title="${c.label}"></button>`).join('')}</div>`;
  }

  // ---------- home ----------
  function renderHome() {
    const fresh = mount('home-' + (code || ''), `
      <div class="wrap home">
        <div class="cover" id="home-cover">
          <div class="title-atlas">ATLAS</div>
          <p class="tagline">Name · Place · Animal · Thing</p>
          <div class="label-sticker">
            <div class="label-row"><span class="k">NAME</span><input id="name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Write your name" enterkeyhint="go"></div>
            <div class="label-row"><span class="k">SUBJECT</span><input id="subject" maxlength="20" autocomplete="off" spellcheck="false"></div>
            <div class="label-row"><span class="k">STD / DIV</span><input id="std" maxlength="12" autocomplete="off" spellcheck="false"></div>
          </div>
          <div class="btn-row">
            ${code
              ? `<button class="btn primary" data-act="join">Join room ${esc(code)}</button><button class="btn small" data-act="newroom">Start my own room</button>`
              : `<button class="btn primary" data-act="create">Start a new room</button>`}
          </div>
          <div class="btn-row"><button class="linkish" data-act="rules">How to play</button></div>
        </div>
        <div class="picker-card" id="pickers"></div>
      </div>`);
    const cover = document.getElementById('home-cover');
    cover.className = `cover cover-${profile.cover}`;
    const name = document.getElementById('name');
    name.className = `f-${profile.font} i-${profile.ink}`;
    if (fresh) {
      // The name is always written fresh on the label; everything else is filled in from last time.
      profile.name = '';
      name.value = '';
      document.getElementById('subject').value = profile.subject;
      document.getElementById('std').value = profile.std;
    }
    for (const id of ['subject', 'std']) document.getElementById(id).className = `f-${profile.font} i-${profile.ink}`;
    patch('pickers', pickersHtml());
  }

  // ---------- lobby ----------
  function renderLobby() {
    const my = me();
    mount('lobby', `
      <div class="wrap">
        ${topbar()}
        <div class="lobby-grid">
          <div>
            <div class="nb" id="register-page"></div>
          </div>
          <div>
            <div class="nb nb-plain diary" style="min-height:0;padding-bottom:20px" id="settings"></div>
            <div class="picker-card" id="lobby-pickers"></div>
          </div>
        </div>
      </div>`);
    document.getElementById('register-page').className = `nb nb-${my.notebook}`;

    const players = state.players;
    const reg = `
      ${pageTop()}
      <h3 class="line">Attendance register</h3>
      <table class="register">
        ${players.map((p, i) => `<tr>
          <td class="roll">${i + 1}.</td>
          <td><span class="mini-cover cover-${p.cover}"></span>${hw(p.name, p.id, p.font, p.ink)}
            ${p.id === state.hostId ? ' <span class="tag">Monitor</span>' : ''}${p.id === state.you ? ' <span class="by">(you)</span>' : ''}</td>
          <td class="present" style="${p.connected ? '' : 'color:var(--red)'}">${p.connected ? 'P' : 'A'}</td>
        </tr>`).join('')}
      </table>
      <div class="line hint">${players.length} of ${state.settings.maxPlayers} seats taken</div>
      <div class="share">
        <code>${esc(roomLink())}</code>
        <button class="btn small" data-act="share">Share</button>
        <a class="btn small" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Come play ATLAS (Name Place Animal Thing) with me! ' + roomLink())}">WhatsApp</a>
      </div>
      <div class="btn-row" style="justify-content:flex-start">
        ${isHost()
          ? `<button class="btn primary" data-act="start">Start the game</button>${players.length < 2 ? '<span class="hint">Waiting for at least one friend… go shout to the next bench!</span>' : ''}`
          : `<span class="hint">Waiting for the monitor (${esc(playerName(state.hostId))}) to start the game… sit straight, fingers on lips.</span>`}
      </div>`;
    patch('register-page', reg);
    patch('settings', settingsHtml());
    patch('lobby-pickers', pickersHtml());
  }

  function settingsHtml() {
    const s = state.settings;
    const host = isHost();
    const head = `<h3>Time table <span class="by">(${host ? 'you are the monitor, set the rules' : 'set by the monitor'})</span></h3>`;
    if (!host) {
      return `${head}
        <div class="readonly-set">
          <div class="set-row"><span>Rounds</span><span>${s.rounds}</span></div>
          <div class="set-row"><span>After STOP!</span><span>${s.countdown} seconds</span></div>
          <div class="set-row"><span>Time per round</span><span>${s.roundLimit} seconds</span></div>
          <div class="set-row"><span>Marks</span><span>${s.scoring === 'classic' ? 'Classic (10 / 5 / 20)' : 'Simple (10 / 0)'}</span></div>
          <div class="set-row"><span>STOP bonus</span><span>${s.stopBonus ? '+5' : 'Off'}</span></div>
          <div class="set-row"><span>Columns</span><span style="text-align:right">${s.columns.map(esc).join(', ')}</span></div>
          <div class="set-row"><span>Skipped letters</span><span>${s.excluded.join(' ') || 'None'}</span></div>
        </div>`;
    }
    const sel = (key, opts, fmt) => `<select data-set="${key}">${opts.map((o) => `<option value="${o}" ${s[key] === o ? 'selected' : ''}>${fmt ? fmt(o) : o}</option>`).join('')}</select>`;
    const custom = s.columns.filter((c) => !PRESETS.some((p) => p.toLowerCase() === c.toLowerCase()));
    return `${head}
      <div class="set-row"><label>Rounds</label>${sel('rounds', [3, 5, 8, 10, 15, 20])}</div>
      <div class="set-row"><label>Max players</label>${sel('maxPlayers', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}</div>
      <div class="set-row"><label>Countdown after STOP!</label>${sel('countdown', [5, 10, 15, 20], (o) => o + ' sec')}</div>
      <div class="set-row"><label>Time per round</label>${sel('roundLimit', [60, 90, 120, 180], (o) => o + ' sec')}</div>
      <div class="set-row"><label>Marks</label><select data-set="scoring">
        <option value="simple" ${s.scoring === 'simple' ? 'selected' : ''}>Simple: unique 10, same 0</option>
        <option value="classic" ${s.scoring === 'classic' ? 'selected' : ''}>Classic: 10, same 5, only one 20</option>
      </select></div>
      <div class="set-row"><label>+5 for whoever shouts STOP</label><button class="chip" data-act="bonus" aria-pressed="${s.stopBonus}">${s.stopBonus ? 'On' : 'Off'}</button></div>
      <div style="margin-top:6px">Columns <span class="by">(pick 2 to 10, tap to add or remove)</span></div>
      <div class="chips">
        ${PRESETS.map((p) => `<button class="chip" data-act="col" data-v="${esc(p)}" aria-pressed="${s.columns.some((c) => c.toLowerCase() === p.toLowerCase())}">${esc(p)}</button>`).join('')}
        ${custom.map((c) => `<button class="chip" data-act="col" data-v="${esc(c)}" aria-pressed="true">${esc(c)} ✕</button>`).join('')}
      </div>
      <div class="add-col"><input id="addcol" maxlength="16" placeholder="Add your own: Sweet, Song, Car…"><button class="btn small" data-act="addcol">Add</button></div>
      <div class="by" style="margin-top:6px">Order: ${s.columns.map(esc).join(' → ')}</div>
      <div style="margin-top:10px">Letters to skip <span class="by">(tap to cross out)</span></div>
      <div class="chips">${ALPHA.map((l) => `<button class="chip letter" data-act="exl" data-v="${l}" aria-pressed="${s.excluded.includes(l)}">${l}</button>`).join('')}</div>`;
  }

  function sendSettings(change) {
    socket.emit('settings', { ...state.settings, ...change });
  }

  // ---------- game ----------
  function renderGame() {
    const my = me();
    const fresh = mount('game', `
      <div class="wrap">
        <div id="topbar"></div>
        <div class="game-grid">
          <div class="nb" id="page">
            <div id="page-top"></div>
            <div id="page-body"></div>
          </div>
          <aside class="side"><div class="sticky" id="marks"></div></aside>
        </div>
      </div>`);
    const page = document.getElementById('page');
    page.className = `nb nb-${my.notebook}`;

    if (fresh) {
      // Coming back into a game (refresh, rejoin): old rounds shouldn't replay their red-pen animation.
      const live = state.phase === 'reveal' ? state.history.length : -1;
      state.history.forEach((r) => { if (r.n !== live) animated.add('r' + r.n); });
    }

    const roundNo = state.round ? state.round.n : state.history.length;
    patch('topbar', topbar(`<span class="chip-btn">Round ${roundNo} of ${state.settings.rounds}</span>${isHost() ? '<button class="chip-btn" data-act="end">End game</button>' : ''}`));
    patch('page-top', pageTop(`<span class="by">Letters done: ${state.used.length ? state.used.join(', ') : 'none yet'}</span>`));
    patch('marks', marksHtml());

    const items = [];
    const reveal = state.phase === 'reveal';
    const hist = reveal ? state.history.slice(0, -1) : state.history;
    for (const r of hist) {
      items.push({ key: 'r' + r.n, html: openRounds.has(r.n) ? roundBlock(r, false, true) : foldedRound(r) });
      items.push({ key: 'ruler' + r.n, html: '<div class="ruler" aria-hidden="true"></div>' });
    }
    if (reveal) {
      const r = state.history[state.history.length - 1];
      items.push({ key: 'court' + r.n, html: courtHtml() });
      items.push({ key: 'r' + r.n, html: roundBlock(r, true) });
      items.push({ key: 'ra' + r.n, html: revealActions() });
    } else if (state.phase === 'picking') {
      items.push({ key: 'p' + state.round.n, html: pickingHtml() });
    } else {
      items.push({ key: 'w' + state.round.n, html: writingHtml() });
    }

    const body = document.getElementById('page-body');
    const hadKeys = new Set([...body.children].map((c) => c.dataset.key));
    patchList(body, items);
    for (const r of state.history) animated.add('r' + r.n);

    if (state.phase === 'picking') {
      updatePicking();
    } else {
      stopFlip();
    }
    if (state.phase === 'writing' || state.phase === 'countdown') updateWriting();

    fitResults();
    const newKey = items[items.length - 1].key;
    if (!hadKeys.has(newKey)) {
      const el = body.lastElementChild;
      const first = el && el.querySelector('.ans:not([disabled])');
      if (first && !first.value) first.focus({ preventScroll: true });
      if (!fresh) setTimeout(() => el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  function rankList(players) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    let rank = 0;
    let last = null;
    return sorted.map((p, i) => {
      if (p.score !== last) { rank = i + 1; last = p.score; }
      return { ...p, rank };
    });
  }

  function marksHtml() {
    const writing = state.phase === 'writing' || state.phase === 'countdown';
    return `<h3>Marks</h3>
      <ul class="score-list">${rankList(state.players).map((p) => `
        <li>
          <span class="rank">${p.rank}.</span>
          <span class="dot ${p.connected ? '' : 'off'}" title="${p.connected ? 'Online' : 'Away'}"></span>
          <span class="nm">${esc(p.name)}${p.id === state.you ? ' (you)' : ''}</span>
          ${p.id === state.hostId ? '<span class="tag" title="Runs the game">Monitor</span>' : ''}
          ${writing && p.playing ? `<span class="by">${p.done ? '✓' : '✎'}</span>` : ''}
          <span class="pts">${p.score}</span>
        </li>`).join('')}
      </ul>`;
  }

  // ----- picking a letter -----
  let flipTimer = null;
  let flipIdx = 0;
  let flipLetter = null;

  function pickingHtml() {
    const r = state.round;
    const mine = r.pickerId === state.you;
    const left = new Set(state.lettersLeft);
    return `
      <div class="round-head"><span class="title">Round ${r.n}</span>
        <span class="clock" data-deadline="${state.deadline}" data-fmt="pick"></span></div>
      <div class="pick-area">
        <div class="flip" id="flip" aria-live="off">?</div>
        ${mine
          ? `<div class="hint">Say the alphabet in your head… and shout STOP!</div>
             <button class="btn red" data-act="flipstop" style="font-size:30px">STOP!</button>
             <div class="hint">or pick straight from the chart</div>
             <div class="alpha-chart">${ALPHA.map((l) => `<button data-act="letter" data-v="${l}" ${left.has(l) ? '' : 'disabled'}>${l}</button>`).join('')}</div>`
          : `<div class="hint" style="font-size:20px">${esc(playerName(r.pickerId))} is choosing a letter…</div><div class="hint">${quip(['Pray it’s not a tough one.', 'No peeping in the atlas!', 'Pencils ready, erasers ready.', 'Silence in class!'], code + r.n)}</div>`}
      </div>`;
  }

  function updatePicking() {
    if (flipTimer) return;
    const letters = state.lettersLeft.length ? state.lettersLeft : ALPHA;
    flipIdx = Math.floor(Math.random() * letters.length);
    flipTimer = setInterval(() => {
      const el = document.getElementById('flip');
      if (!el || !state || state.phase !== 'picking') return stopFlip();
      const list = state.lettersLeft.length ? state.lettersLeft : ALPHA;
      flipIdx = (flipIdx + 1) % list.length;
      flipLetter = list[flipIdx];
      el.textContent = flipLetter;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
      if (state.round && state.round.pickerId === state.you) sfx.flip();
    }, 120);
  }
  function stopFlip() {
    clearInterval(flipTimer);
    flipTimer = null;
  }

  // ----- writing -----
  function writingHtml() {
    const r = state.round;
    const my = me();
    const playing = r.participants.includes(state.you);
    return `
      <div class="round-head">
        <span class="title">Round ${r.n} · Letter</span>
        <span class="big-letter">${esc(r.letter)}</span>
        <span class="by">chosen by ${esc(playerName(r.pickerId))}</span>
        <span class="clock" data-deadline="" data-fmt="clock" id="round-clock"></span>
      </div>
      <div id="cd"></div>
      ${playing
        ? `<div class="write-grid">${r.columns.map((c, i) => `
            <div class="wfield"><label for="a${i}">${esc(c)}</label>
              <input id="a${i}" class="ans f-${my.font} i-${my.ink}" data-i="${i}" maxlength="30" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="${i === r.columns.length - 1 ? 'done' : 'next'}" placeholder="${esc(r.letter)}…"></div>`).join('')}
           </div>`
        : `<div class="line hint">You came in mid-round. Watch this one, you’ll write from the next round.</div>`}
      <div id="status"></div>
      <div id="stopzone"></div>`;
  }

  const answerInputs = () => [...document.querySelectorAll('.ans')];
  const answerValues = () => answerInputs().map((el) => el.value.trim());

  function updateWriting() {
    const r = state.round;
    const inputs = answerInputs();
    if (state.myDraft && inputs.length) {
      inputs.forEach((el, i) => {
        if (!el.value && state.myDraft[i] && document.activeElement !== el) el.value = state.myDraft[i];
        el.disabled = state.myDone;
      });
    }
    const clock = document.getElementById('round-clock');
    if (clock) clock.dataset.deadline = state.phase === 'writing' ? state.deadline : '';

    patch('cd', state.phase === 'countdown'
      ? `<div class="countdown-banner"><span>${esc(playerName(r.stopBy))} shouted STOP!</span><span class="num" data-deadline="${state.deadline}" data-fmt="s"></span><span>${quip(['pens down!', 'teacher is coming!', 'the bell is ringing!', 'write fast, write fast!'], code + r.n)}</span></div>`
      : '');

    const people = state.players.filter((p) => p.playing);
    patch('status', `<div class="status-line">${people.map((p) => {
      const s = !p.connected ? 'away' : p.done ? '✓ done' : `✎ ${p.filled}/${r.columns.length}`;
      return `<span class="${p.done ? 'done' : ''}">${esc(p.name)}${p.id === state.you ? ' (you)' : ''}: ${s}</span>`;
    }).join('')}</div>`);
    updateStopZone();
    tickClocks();
  }

  function updateStopZone() {
    if (!state || !state.round) return;
    const playing = state.round.participants.includes(state.you);
    let html = '';
    if (!playing) html = '';
    else if (state.myDone) html = '<span class="hint">✓ Pens down. Your answers are locked. Don’t look at your neighbour’s notebook…</span>';
    else if (state.phase === 'writing') {
      const vals = answerValues();
      const all = vals.length && vals.every((v) => v);
      html = all
        ? `<button class="stop-btn" data-act="stop">STOP!</button><span class="hint">Everyone else gets ${state.settings.countdown} seconds!</span>`
        : `<span class="hint">Fill every column to shout STOP!</span>`;
    } else if (state.phase === 'countdown') {
      html = `<button class="btn primary" data-act="stop">I’m done ✓</button><span class="hint">Quick! Blanks get a big fat 0.</span>`;
    }
    const ready = /data-act="stop"/.test(html);
    patch('stopzone', `<div class="stop-zone ${ready ? 'ready' : ''}">${html}</div>`);
  }

  let draftTimer = null;
  function sendDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => socket.emit('draft', answerValues()), 300);
  }

  // ----- results -----
  const openRounds = new Set();

  function cellHtml(r, row, c, ci, ri, live) {
    const my = state.you;
    const d = `--d:${(ci * 0.55 + ri * 0.12).toFixed(2)}s`;
    const rr = rng(hash(row.pid + ci + r.n));
    const strike = `--r:${((rr() - 0.5) * 9).toFixed(1)}deg`;
    if (c.status === 'blank') return '<span class="blank">—</span>';
    const word = `<span class="w">${hw(c.text, row.pid + ci, row.font, row.ink)}</span>`;
    const why = c.sameAs ? `= ${esc(c.sameAs)}?` : quip(['copied?', 'same same!', 'twins!', 'copy cat!'], row.pid + ci + r.n);
    let inner;
    if (c.status === 'unique') inner = `<span class="cell">${word}<span class="mark" style="${d}">${c.points}</span>${c.givenBack ? `<span class="note" style="${d}">given back ✓</span>` : ''}</span>`;
    else if (c.status === 'dup') inner = `<span class="cell cut" style="${d};${strike}">${word}${c.points ? `<span class="mark" style="${d}">${c.points}</span>` : ''}<span class="note" style="${d}">${why}</span></span>`;
    else if (c.status === 'wrong') inner = `<span class="cell cut" style="${d};${strike}">${word}<span class="note" style="${d}">not ${esc(r.letter)}!</span></span>`;
    else inner = `<span class="cell cut" style="${d};${strike}">${word}<span class="note" style="${d}">✗ class said no</span></span>`;
    if (!live) return inner;

    const playing = r.rows.some((x) => x.pid === my);
    const backable = c.status === 'dup' || c.givenBack;
    const cuttable = !backable && c.key && c.status !== 'wrong';
    const count = backable ? c.backVotes : c.votes;
    const tally = count ? ` ✋${count}` : '';
    if (!playing || row.pid === my) {
      // Your own answer: you can't vote on it, but you can see how the class is voting.
      if (backable && row.pid === my) return `${inner}<span class="vote-chip mine">↩ ask friends${tally}</span>`;
      return inner + (count ? `<span class="vote-chip mine">${backable ? '↩' : '✗'}${tally}</span>` : '');
    }
    if (backable) {
      const voted = (((r.appeals || {})[ci] || {})[row.pid] || []).includes(my);
      return `<button class="obj ${voted ? 'voted' : ''}" data-act="appeal" data-ci="${ci}" data-pid="${esc(row.pid)}" title="${voted ? 'Take back your vote' : 'Vote to give this answer back'}">${inner}<span class="vote-chip back">${voted ? '↩ you said give back' : '↩ give back?'}${tally}</span></button>`;
    }
    if (cuttable) {
      const voted = ((r.challenges[ci] || {})[c.key] || []).includes(my);
      return `<button class="obj ${voted ? 'voted' : ''}" data-act="object" data-ci="${ci}" data-key="${esc(c.key)}" title="${voted ? 'Take back your vote' : 'Vote to cut this answer'}">${inner}<span class="vote-chip">${voted ? '✗ you said cut' : '✗ cut?'}${tally}</span></button>`;
    }
    return inner;
  }

  // The class decides, not the computer: shown right above the marks while voting is open.
  function courtHtml() {
    const r = state.history[state.history.length - 1];
    if (!r.rows.some((row) => row.pid === state.you)) return '';
    return `<div class="court">
      <div class="court-title">⚖️ Class court is open!</div>
      <div>The computer only <i>suggests</i> marks. You and your friends decide.</div>
      <div class="court-rules">
        <span><b class="chip-demo">✗ cut?</b> Tap an answer you think is wrong or made up.</span>
        <span><b class="chip-demo back">↩ give back?</b> Tap a cut answer that was really different (Karan ≠ Kiran).</span>
      </div>
      <div class="by">If more than half of the others agree, the marks change straight away. Tap again to take your vote back.</div>
    </div>`;
  }

  function totalHtml(row, ri, nCols) {
    const td = `--d:${(nCols * 0.55 + 0.2 + ri * 0.12).toFixed(2)}s`;
    const notes = [];
    if (row.bonus) notes.push(`+${row.bonus} STOP`);
    if (row.total === 0) notes.push('duck! 🦆');
    else if (row.cells.every((c) => c.status === 'unique')) notes.push('Shabash! ★');
    return `<span class="reveal-total" style="${td}"><span>${row.total}</span></span>${notes.map((n) => ` <span class="note" style="${td}">${n}</span>`).join('')}`;
  }

  function roundBlock(r, live, foldable) {
    const my = state.you;
    const noAnim = animated.has('r' + r.n);
    const nCols = r.columns.length;
    const stopper = r.rows.find((row) => row.pid === r.stopBy);
    const table = r.rows.map((row, ri) => `<tr class="${row.pid === my ? 'me' : ''}">
        <td class="pname">${esc(row.name)}</td>
        ${row.cells.map((c, ci) => `<td>${cellHtml(r, row, c, ci, ri, live)}</td>`).join('')}
        <td class="total">${totalHtml(row, ri, nCols)}</td>
      </tr>`).join('');
    // The same marks laid out one column at a time, for screens too narrow for the table.
    const cards = r.columns.map((col, ci) => `<div class="colcard">
        <div class="line cc-head"><span class="u">${esc(col)}</span></div>
        ${r.rows.map((row, ri) => `<div class="line cc-row ${row.pid === my ? 'me' : ''}"><span class="cc-name">${esc(row.name)}</span>${cellHtml(r, row, row.cells[ci], ci, ri, live)}</div>`).join('')}
      </div>`).join('') + `<div class="colcard">
        <div class="line cc-head"><span class="u">Marks</span></div>
        ${r.rows.map((row, ri) => `<div class="line cc-row total ${row.pid === my ? 'me' : ''}"><span class="cc-name">${esc(row.name)}</span>${totalHtml(row, ri, nCols)}</div>`).join('')}
      </div>`;
    return `<div class="round-block ${noAnim ? 'no-anim' : ''}">
      <div class="round-head">
        <span class="title">Round ${r.n} · Letter</span><span class="big-letter" style="font-size:40px">${esc(r.letter)}</span>
        <span class="by">chosen by ${esc(r.pickerName)}</span>
        ${stopper ? `<span class="stop-stamp">STOP! by ${esc(stopper.name)}</span>` : ''}
        ${foldable ? `<button class="fold-btn" data-act="fold" data-n="${r.n}">fold ▴</button>` : ''}
      </div>
      <div class="tablewrap"><table class="rows">
        <tr><th></th>${r.columns.map((c) => `<th><span class="u">${esc(c)}</span></th>`).join('')}<th><span class="u">Marks</span></th></tr>
        ${table}
      </table></div>
      <div class="colcards">${cards}</div>
    </div>`;
  }

  // Older rounds fold into one line so the page doesn't keep growing; tap to open the full page again.
  function foldedRound(r) {
    const ranked = [...r.rows].sort((a, b) => b.total - a.total);
    return `<button class="folded" data-act="fold" data-n="${r.n}" title="Open round ${r.n}">
      <span class="title">Round ${r.n}</span><span class="fl">${esc(r.letter)}</span>
      <span class="fs">${ranked.map((row) => `${esc(row.name)} <b>${row.total}</b>`).join(' · ')}</span>
      <span class="open">open ▾</span>
    </button>`;
  }

  // Use the table when it fits; switch to column cards when it would need a sideways scroll.
  function fitResults() {
    document.querySelectorAll('.round-block').forEach((b) => {
      const wrap = b.querySelector('.tablewrap');
      const table = wrap && wrap.querySelector('table');
      if (!table) return;
      const narrow = table.scrollWidth > wrap.clientWidth + 2;
      if (b.classList.contains('narrow') !== narrow) b.classList.toggle('narrow', narrow);
    });
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitResults, 120); });

  function revealActions() {
    const last = state.history.length >= state.settings.rounds || state.lettersLeft.length === 0;
    return `<div class="reveal-actions">
      ${isHost()
        ? `<button class="btn primary" data-act="next">${last ? 'See the report card →' : 'Next round →'}</button>`
        : `<span class="hint">Waiting for the monitor (${esc(playerName(state.hostId))}) to turn the page… probably sharpening a pencil.</span>`}
    </div>`;
  }

  // ---------- report card ----------
  function renderEnded() {
    const my = me();
    mount('ended', `
      <div class="wrap">
        <div id="topbar"></div>
        <div class="report" id="report"></div>
        <div class="nb" id="final-page"><div id="final-top"></div><div id="final-body"></div></div>
      </div>`);
    stopFlip();
    patch('topbar', topbar());
    document.getElementById('final-page').className = `nb nb-${my.notebook}`;
    const list = rankList(state.players);
    const top = list.length ? list[0].score : 0;
    const grade = (s) => {
      if (!top) return 'A';
      const pct = s / top;
      return pct >= 0.9 ? 'A+' : pct >= 0.75 ? 'A' : pct >= 0.6 ? 'B' : pct >= 0.4 ? 'C' : 'D';
    };
    const remark = (p, g) => {
      if (p.rank === 1) return 'Class topper! First bench for you ★';
      return {
        'A+': 'Excellent! Parents can be proud',
        A: 'Very good. Keep it up',
        B: 'Good, but talks too much in class',
        C: 'Can do better. Less cricket, more Atlas',
        D: 'Seen dreaming in class. Meet me with parents',
      }[g];
    };
    patch('report', `
      <h2>PROGRESS REPORT</h2>
      <p class="school">Atlas Public School · Std ${esc(profile.std)} · ${state.history.length} round${state.history.length === 1 ? "" : "s"} · ${today()}</p>
      <div class="tablewrap"><table>
        <tr><th>Rank</th><th>Name</th><th>Marks</th><th>Grade</th><th>Remarks</th></tr>
        ${list.map((p) => { const g = grade(p.score); return `<tr>
          <td>${p.rank}</td><td>${hw(p.name, p.id, p.font, p.ink)}${p.id === state.you ? ' <span class="by">(you)</span>' : ''}</td>
          <td class="grade">${p.score}</td><td class="grade">${g}</td><td class="remark">${remark(p, g)}</td></tr>`; }).join('')}
      </table></div>
      <div class="signs">
        <div>Class teacher<span class="sig">S. Radhakrishnan</span></div>
        <div>Parent’s signature<span class="sig">&nbsp;</span>______________</div>
      </div>
      <div class="btn-row">
        ${isHost() ? '<button class="btn primary" data-act="again">Play again</button>' : `<span class="hint">The monitor (${esc(playerName(state.hostId))}) can start a new game.</span>`}
        <button class="btn" data-act="leave">Leave</button>
      </div>`);
    patch('final-top', pageTop('<span class="title" style="font-family:\'Gochi Hand\',cursive;font-size:24px">Our notebook</span>'));
    const items = [];
    for (const r of state.history) {
      animated.add('r' + r.n);
      items.push({ key: 'r' + r.n, html: roundBlock(r, false) });
      items.push({ key: 'ruler' + r.n, html: '<div class="ruler" aria-hidden="true"></div>' });
    }
    patchList(document.getElementById('final-body'), items);
    fitResults();
  }

  // ---------- clocks ----------
  let lastTick = null;
  function tickClocks() {
    if (!state) return;
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      const dl = Number(el.dataset.deadline);
      if (!dl) { el.textContent = ''; return; }
      const secs = Math.max(0, Math.ceil((dl - now()) / 1000));
      const fmt = el.dataset.fmt;
      if (fmt === 's') {
        el.textContent = secs;
        if (secs !== lastTick && secs > 0) { lastTick = secs; sfx.tick(); }
      } else if (fmt === 'pick') {
        el.textContent = `⏰ random letter in ${secs}s`;
      } else {
        el.textContent = `⏰ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        el.classList.toggle('low', secs <= 15);
      }
    });
  }
  setInterval(tickClocks, 200);

  // ---------- rules ----------
  function closeRules() {
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    document.body.classList.remove('modal-open');
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRules(); });

  function showRules() {
    if (document.querySelector('.overlay')) return;
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="sticky" role="dialog" aria-modal="true" aria-label="How to play" tabindex="-1">
      <h3>How to play ATLAS</h3>
      <ol>
        <li>Every round, one friend picks a letter. Turns go one by one.</li>
        <li>Everyone writes one word starting with that letter for each column: Name, Place, Animal, Thing…</li>
        <li>Filled every column? Shout <b>STOP!</b> Everyone else gets ${state ? state.settings.countdown : 10} seconds. Then pens down.</li>
        <li>Same answer as someone else? The teacher cuts it. No marks.</li>
        <li>An answer nobody else wrote gets <b>10 marks</b>. Blanks and wrong letters get 0.</li>
        <li>Spelling slips, plurals and other names for the same place count as the same answer (“Banglore” = “Bengaluru” = “Bangalore”, “Bombay” = “Mumbai”, “Bats” = “Bat”).</li>
        <li><b>Class court:</b> the computer only suggests. Tap <b>✗ cut?</b> on an answer you think is wrong, or <b>↩ give back?</b> on a cut answer that was really different. If more than half of the others agree, the marks change.</li>
        <li>Most marks after the last round tops the class!</li>
      </ol>
      <div class="by">Classic marks: unique 10, same 5, and 20 if you were the only one to write anything in that column.</div>
      <div class="btn-row"><button class="btn primary" data-act="close-rules">Got it</button></div>
    </div>`;
    o.addEventListener('click', (e) => { if (e.target === o) closeRules(); });
    document.body.appendChild(o);
    document.body.classList.add('modal-open');
    o.querySelector('.sticky').focus();
  }

  // ---------- events ----------
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomLink());
      toast('Link copied. Send it to your friends!');
    } catch {
      toast(roomLink());
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    switch (act) {
      case 'home': e.preventDefault(); if (!state) { code = null; history.replaceState(null, '', '/'); render(); } break;
      case 'create': createRoom(); break;
      case 'join': joinRoom(); break;
      case 'newroom': code = null; history.replaceState(null, '', '/'); render(); break;
      case 'rules': showRules(); break;
      case 'close-rules': closeRules(); break;
      case 'fold': {
        const n = Number(b.dataset.n);
        if (openRounds.has(n)) openRounds.delete(n);
        else openRounds.add(n);
        render();
        break;
      }
      case 'copy': copyLink(); break;
      case 'share':
        if (navigator.share) navigator.share({ title: 'ATLAS', text: 'Come play ATLAS with me!', url: roomLink() }).catch(() => {});
        else copyLink();
        break;
      case 'mute':
        muted = !muted;
        ls.set('atlas.muted', muted);
        b.innerHTML = muteLabel();
        break;
      case 'leave':
        if (!state || state.phase === 'lobby' || state.phase === 'ended' || confirm('Leave this game? Your marks stay in the notebook.')) leaveRoom();
        break;
      case 'prof':
        profile[b.dataset.k] = b.dataset.v;
        saveProfile();
        if (state) socket.emit('profile', look());
        render();
        break;
      case 'start':
        socket.emit('start', null, (res) => res && res.error && toast(res.error));
        break;
      case 'bonus': sendSettings({ stopBonus: !state.settings.stopBonus }); break;
      case 'col': {
        const v = b.dataset.v;
        const cols = state.settings.columns;
        const has = cols.some((c) => c.toLowerCase() === v.toLowerCase());
        if (has && cols.length <= 2) return toast('Keep at least 2 columns.');
        if (!has && cols.length >= 10) return toast('10 columns is the most.');
        sendSettings({ columns: has ? cols.filter((c) => c.toLowerCase() !== v.toLowerCase()) : [...cols, v] });
        break;
      }
      case 'addcol': addColumn(); break;
      case 'exl': {
        const l = b.dataset.v;
        const ex = state.settings.excluded;
        const next = ex.includes(l) ? ex.filter((x) => x !== l) : [...ex, l];
        if (next.length > 20) return toast('Leave at least 6 letters to play with.');
        sendSettings({ excluded: next });
        break;
      }
      case 'flipstop':
        if (flipLetter) socket.emit('pickLetter', flipLetter);
        break;
      case 'letter': socket.emit('pickLetter', b.dataset.v); break;
      case 'stop':
        clearTimeout(draftTimer);
        socket.emit('stop', answerValues());
        break;
      case 'object': socket.emit('challenge', { ci: Number(b.dataset.ci), key: b.dataset.key }); break;
      case 'appeal': socket.emit('appeal', { ci: Number(b.dataset.ci), pid: b.dataset.pid }); break;
      case 'next': socket.emit('next'); break;
      case 'end': if (confirm('End the game now and show the report card?')) socket.emit('endGame'); break;
      case 'again': socket.emit('playAgain'); break;
      default: break;
    }
  });

  function addColumn() {
    const el = document.getElementById('addcol');
    const v = (el.value || '').trim().slice(0, 16);
    if (!v) return;
    const cols = state.settings.columns;
    if (cols.length >= 10) return toast('10 columns is the most.');
    if (cols.some((c) => c.toLowerCase() === v.toLowerCase())) return toast('That column is already there.');
    el.value = '';
    sendSettings({ columns: [...cols, v] });
  }

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-set]');
    if (!el || !state) return;
    const key = el.dataset.set;
    const v = key === 'scoring' ? el.value : Number(el.value);
    sendSettings({ [key]: v });
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'subject' || el.id === 'std') {
      profile[el.id] = el.value.slice(0, 20);
      saveProfile();
    } else if (el.id === 'name') {
      profile.name = el.value.slice(0, 16);
      saveProfile();
      patch('pickers', pickersHtml());
    } else if (el.classList.contains('ans')) {
      const clean = el.value.replace(/[^A-Za-z ]/g, '').replace(/^ +/, '').replace(/ {2,}/g, ' ');
      if (clean !== el.value) {
        const pos = Math.max(0, (el.selectionStart || 0) - (el.value.length - clean.length));
        el.value = clean;
        el.setSelectionRange(pos, pos);
        toast('Numbers are for Maths period! Letters A to Z only.');
      }
      sendDraft();
      updateStopZone();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const el = e.target;
    if (el.id === 'name') { e.preventDefault(); if (code) joinRoom(); else createRoom(); }
    else if (el.id === 'addcol') { e.preventDefault(); addColumn(); }
    else if (el.classList.contains('ans')) {
      e.preventDefault();
      const inputs = answerInputs();
      const i = inputs.indexOf(el);
      const nextEmpty = inputs.slice(i + 1).find((x) => !x.value.trim()) || inputs.find((x) => !x.value.trim());
      if (nextEmpty) nextEmpty.focus();
      else el.blur();
    }
  });

  window.addEventListener('popstate', () => { code = codeFromUrl(); state = null; render(); });

  render();
})();
