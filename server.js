const express = require('express'), http = require('http'), os = require('os');
const { Server } = require('socket.io');
const { ITEMS, STORAGES } = require('./data');
const app = express();
app.get('/', (q, s) => s.sendFile(__dirname + '/index.html'));
app.get('/healthz', (q, s) => s.send('ok')); // Render sağlık kontrolü
const STATIC = ['manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
STATIC.forEach(f => app.get('/' + f, (q, s) => s.sendFile(__dirname + '/' + f, err => { if (err && !s.headersSent) s.status(404).end(); })));
app.use('/cards', express.static(__dirname + '/cards', { maxAge: '7d' }));
const server = http.createServer(app), io = new Server(server);

const MIN = +process.env.MIN_PLAYERS || 3, MAX = 7, START = 5000, FEE = 100, PENALTY = 1000;
const T = +process.env.TIME_SCALE || 1; // sadece test için: süreleri kısaltır
const ACT_MS = 25000 * T, OPEN_MS = 20000 * T, SELL_MS = 10000 * T, RESULT_MS = 9500 * T, PAY_MS = 30000 * T;
const rooms = {};
const fmt = n => n.toLocaleString('tr-TR') + '$';
const uid = () => Math.random().toString(36).slice(2, 10);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const P = (r, id) => r.players.find(p => p.id === id);
const active = r => r.players.filter(p => !p.eliminated);
const log = (r, t) => { r.log.push(t); if (r.log.length > 30) r.log.shift(); };
const clear = r => { clearTimeout(r.timer); r.deadline = null; };
const later = (r, ms, fn) => { clear(r); r.deadline = Date.now() + ms; r.timer = setTimeout(fn, ms); };
const sum = a => a.reduce((s, c) => s + c.value, 0);
const collateral = p => p.items.filter(c => c.value > 0); // teminat olarak sadece değeri pozitif eşyalar kullanılabilir
const worth = p => p.money + sum(collateral(p));

function after(r, id) { // mezatçının solundan başlayarak aktif oyuncular
  const i = r.players.findIndex(p => p.id === id), n = r.players.length, out = [];
  for (let k = 1; k < n; k++) { const p = r.players[(i + k) % n]; if (!p.eliminated) out.push(p.id); }
  return out;
}
function draw(r, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!r.itemDeck.length) { r.itemDeck = shuffle(r.discard); r.discard = []; }
    if (!r.itemDeck.length) break;
    out.push(r.itemDeck.pop());
  }
  return out;
}
// Para üstü verilmediği için, "need" tutarını karşılayan en az fazlalıklı eşya kombinasyonunu bulur
function autoPick(p, need) {
  const cap = need + 10000, reach = new Map([[0, []]]);
  for (const c of collateral(p)) for (const [s, ids] of [...reach]) { const t = s + c.value; if (t <= cap && !reach.has(t)) reach.set(t, ids.concat(c.id)); }
  let best = null;
  for (const [s, ids] of reach) if (s >= need && (!best || s < best.s || (s === best.s && ids.length < best.ids.length))) best = { s, ids };
  return best ? best.ids : [];
}
const take = (from, to, ids) => { const pick = from.items.filter(c => ids.includes(c.id)); pick.forEach(c => from.items.splice(from.items.indexOf(c), 1)); to.items.push(...pick); return pick; };

function view(r, me) {
  const vis = i => { const l = r.lot[i]; return l.up ? l.card : (r.peeks && r.peeks[me.id] && r.peeks[me.id][i]) || null; };
  const sale = r.phase === 'shield' ? r.sale : null;
  let shield = null;
  if (sale && sale.winner === me.id) {
    const evs = sale.cards.filter(c => c.kind === 'event' && c.effect !== 'shield');
    const sh = me.items.concat(sale.cards).filter(c => c.effect === 'shield').length;
    shield = { evs: evs.map(c => c.name), max: Math.min(evs.length, sh) };
  }
  return {
    code: r.code, gid: r.gid, phase: r.phase, host: r.host, min: MIN, max: MAX, now: Date.now(), deadline: r.deadline || null,
    me: { id: me.id, name: me.name, money: me.money, items: me.items },
    log: r.log.slice(-8), turn: r.turn, total: r.total, aud: r.aud, storage: r.storage, step: r.step,
    decks: { item: (r.itemDeck || []).length, storage: (r.storageDeck || []).length },
    players: r.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, on: p.on, out: p.eliminated, n: p.items.length, dec: r.dec && r.dec[p.id] })),
    lot: (r.lot || []).map((l, i) => ({ up: l.up, card: vis(i) })),
    pending: r.pending || [], cur: r.phase === 'join' ? r.order[r.ji] : null,
    bidders: r.bidders || [], bid: r.phase === 'bid' ? r.bid : null,
    pay: r.phase === 'pay' ? { who: r.sale.winner, price: r.sale.price, short: r.sale.short } : null,
    res: r.phase === 'result' && r.res ? { text: r.res.text, fx: r.res.fx || [], winner: r.res.winner || null, n: r.res.n || 0, reveal: r.res.reveal || null, at: r.res.at, gain: r.res.winner === me.id ? r.res.gain : null } : null,
    shield, shieldWho: sale ? sale.winner : null, final: r.final, stats: r.phase === 'over' ? r.stats : null,
  };
}
const emit = r => {
  const k = r.phase + ':' + r.turn; // yeni aşamada botlara animasyonlar için kısa bekleme süresi tanı
  if (r.seen !== k) { r.seen = k; r.hold = Date.now() + T * (r.phase === 'prep' ? 3000 : r.phase === 'result' ? 1500 : 700); }
  r.players.forEach(p => { if (p.on && p.sid && !p.bot) io.to(p.sid).emit('state', view(r, p)); });
};

// Aşamada karar vermesi beklenen oyuncular
function who(r) {
  if (r.phase === 'prep') return [r.aud];
  if (r.phase === 'peekBefore' || r.phase === 'peekAfter') return r.pending;
  if (r.phase === 'join') return [r.order[r.ji]];
  if (r.phase === 'shield' || r.phase === 'pay') return [r.sale.winner];
  return [];
}
// Süre dolarsa (veya oyuncu çevrimdışıysa) otomatik hamle yapılır; oyun asla kilitlenmez
function arm(r) {
  const ps = who(r).map(id => P(r, id)).filter(Boolean);
  later(r, ps.length && ps.every(p => p.bot || !p.on) ? 1500 : ACT_MS, () => ps.forEach(p => { if (!p.bot) try { botAct(r, p, true); } catch (e) { console.error('auto', e); } }));
}

function startGame(r) {
  r.players.forEach(p => Object.assign(p, { money: START, items: [], eliminated: false, turnsLed: 0 }));
  r.itemDeck = shuffle(ITEMS); r.discard = []; r.storageDeck = shuffle(STORAGES);
  r.gid = (r.gid || 0) + 1; r.turn = 0; r.total = r.players.length * 2; r.seat = Math.floor(Math.random() * r.players.length) - 1;
  r.log = []; r.final = null; r.sale = null; r.stats = { best: null, junk: null }; nextTurn(r);
}
function nextTurn(r) {
  clear(r);
  const n = r.players.length; let next = null;
  for (let k = 1; k <= n; k++) { const i = (r.seat + k + n) % n, p = r.players[i]; if (!p.eliminated && p.turnsLed < 2) { next = p; r.seat = i; break; } }
  if (!next || active(r).length < 2 || !r.storageDeck.length) return endGame(r);
  next.turnsLed++; r.turn++; r.aud = next.id;
  r.storage = r.storageDeck.pop();
  r.lot = draw(r, r.storage.items).map(card => ({ card, up: false }));
  r.peeks = {}; r.joined = []; r.dec = {}; r.res = null; r.bid = null; r.pending = [];
  r.step = r.storage.open ? 'flip' : 'peek'; r.phase = 'prep';
  log(r, `— Tur ${r.turn}: ${next.name} mezatçı. Depo: ${r.storage.name} (${r.storage.items} eşya)`);
  arm(r); emit(r);
}
function afterPrep(r) {
  if (r.storage.peek === 'before') return startPeek(r, 'peekBefore', after(r, r.aud));
  startJoin(r);
}
function startPeek(r, phase, ids) { r.phase = phase; r.pending = ids.slice(); arm(r); emit(r); }
function donePeek(r) { r.pending = []; r.phase === 'peekBefore' ? startJoin(r) : startBid(r, r.joined); }
function startJoin(r) { r.phase = 'join'; r.order = after(r, r.aud); r.ji = 0; arm(r); emit(r); }
function joinNext(r) {
  r.ji++;
  if (r.ji < r.order.length) { arm(r); return emit(r); }
  if (!r.joined.length) { log(r, 'Kimse mezata katılmadı, depo ıskartaya.'); return finish(r, { text: 'Kimse mezata katılmadı.' }); }
  if (r.storage.peek === 'after') return startPeek(r, 'peekAfter', r.joined);
  startBid(r, r.joined);
}
function finish(r, res) {
  r.lot.forEach(l => r.discard.push(l.card)); r.lot = [];
  r.phase = 'result'; r.res = res; later(r, RESULT_MS, () => nextTurn(r)); emit(r);
}
function startBid(r, bidders) {
  r.phase = 'bid'; r.bidders = bidders.slice(); r.bid = { amt: 0, who: null, hist: [] };
  later(r, OPEN_MS, () => bidTimeout(r)); emit(r);
}
function setBid(r, id, amt, forced) {
  r.bid.amt = amt; r.bid.who = id;
  r.bid.hist.unshift(`${P(r, id).name}: ${fmt(amt)}${forced ? ' (otomatik açılış)' : ''}`); r.bid.hist = r.bid.hist.slice(0, 5);
  later(r, SELL_MS, () => bidTimeout(r)); emit(r);
}
function bidTimeout(r) { if (!r.bid.who) setBid(r, r.bidders[0], FEE, true); else sell(r); }

function sell(r) {
  const w = P(r, r.bid.who), price = r.bid.amt, short = Math.max(0, price - w.money);
  r.sale = { winner: w.id, price, short, cards: r.lot.map(l => l.card) };
  if (!short) return settle(r, []);
  if (sum(collateral(w)) < short) return failPay(r, w);
  // Para yetmiyor: eşyalar teminat olarak kullanılabilir (para üstü verilmez)
  r.phase = 'pay'; log(r, `${w.name} mezatı ${fmt(price)} ile kazandı; yetmeyen ${fmt(short)} için eşyalarını teminat gösteriyor...`);
  later(r, PAY_MS, () => settle(r, autoPick(w, short))); emit(r);
}
function failPay(r, w) { // ödeyemedi: 1000$ ceza, mezat onsuz yeniden başlar
  const a = P(r, r.aud), { price } = r.sale;
  if (worth(w) >= PENALTY) {
    const cash = Math.min(w.money, PENALTY), rest = PENALTY - cash;
    w.money -= cash; a.money += cash; if (rest) take(w, a, autoPick(w, rest));
    log(r, `${w.name} ${fmt(price)} bedelini ödeyemedi, ${fmt(PENALTY)} ceza ödedi. Mezat ${w.name} olmadan baştan başlıyor.`);
  } else { a.money += w.money; w.money = 0; w.eliminated = true; w.items.forEach(c => r.discard.push(c)); w.items = []; log(r, `${w.name} ödeyemedi ve cezayı da karşılayamadı: oyundan elendi.`); }
  r.bidders = r.bidders.filter(id => id !== w.id); r.sale = null;
  if (!r.bidders.length) return finish(r, { text: 'Teklif verecek kimse kalmadı, depo ıskartaya.' });
  startBid(r, r.bidders);
}
function settle(r, ids) {
  const { winner, price, short } = r.sale, w = P(r, winner), a = P(r, r.aud), cards = r.sale.cards;
  if (short) {
    let pick = collateral(w).filter(c => ids.includes(c.id));
    if (sum(pick) < short) pick = collateral(w).filter(c => autoPick(w, short).includes(c.id));
    take(w, a, pick.map(c => c.id)); a.money += w.money; w.money = 0;
    log(r, `${w.name}, ${fmt(price)} bedelini ${pick.length} eşya teminatıyla ödedi (para üstü verilmez).`);
  } else { w.money -= price; a.money += price; }
  const evs = cards.filter(c => c.kind === 'event' && c.effect !== 'shield');
  const sh = w.items.concat(cards).filter(c => c.effect === 'shield');
  if (evs.length && sh.length) { r.phase = 'shield'; log(r, `${w.name} mezatı ${fmt(price)} ile kazandı. Güvenlik Ağı kullanıp kullanmayacağına karar veriyor...`); arm(r); return emit(r); }
  resolve(r, 0);
}
function resolve(r, use) {
  const { winner, price, cards } = r.sale, w = P(r, winner), fx = [];
  let held = cards.slice();
  let evs = cards.filter(c => c.kind === 'event' && c.effect !== 'shield').sort((a, b) => (b.effect === 'wreck') - (a.effect === 'wreck'));
  const nSh = w.items.concat(cards).filter(c => c.effect === 'shield').length;
  use = Math.max(0, Math.min(use | 0, evs.length, nSh));
  for (let i = 0; i < use; i++) { // kalkan harca (önce eldekiler)
    let k = w.items.findIndex(c => c.effect === 'shield');
    r.discard.push(k >= 0 ? w.items.splice(k, 1)[0] : held.splice(held.findIndex(c => c.effect === 'shield'), 1)[0]);
  }
  evs.splice(0, use).forEach(c => { held.splice(held.indexOf(c), 1); r.discard.push(c); });
  if (use) fx.push(`${use} Güvenlik Ağı kullanıldı, ${use} Olay kartı iptal edildi.`);
  const wreck = evs.find(c => c.effect === 'wreck'), fraud = evs.find(c => c.effect === 'fraud');
  if (wreck) { fx.push(`TAHRİBAT! ${wreck.name}: depo ve tüm eşyalar geçersiz.`); held.forEach(c => r.discard.push(c)); held = []; }
  else if (fraud) {
    held.splice(held.indexOf(fraud), 1); r.discard.push(fraud);
    const items = held.filter(c => c.kind !== 'event');
    if (items.length) { const top = items.reduce((x, y) => y.value > x.value ? y : x); held.splice(held.indexOf(top), 1); r.discard.push(top); fx.push('SAHTE ALTIN! Depodaki en pahalı eşya geçersiz sayıldı.'); }
    else fx.push('SAHTE ALTIN! Ama geçersiz kılınacak eşya yoktu.');
  }
  w.items.push(...held); r.lot = [];
  const gv = sum(held), deal = { name: w.name, storage: r.storage.name, price, value: gv, profit: gv - price, n: held.length }; // oyun sonu istatistiği: en kârlı mezat
  if (r.stats && (!r.stats.best || deal.profit > r.stats.best.profit)) r.stats.best = deal;
  const text = `${w.name} mezatı ${fmt(price)} ile kazandı.`;
  log(r, text); fx.forEach(t => log(r, t));
  finish(r, { text, fx, winner: w.id, gain: held, n: held.length });
}
function endGame(r) {
  clear(r); r.phase = 'over';
  r.final = r.players.map(p => { const iv = sum(p.items); return { id: p.id, name: p.name, bot: !!p.bot, money: p.money, iv, total: p.money + iv, items: p.items, out: p.eliminated }; })
    .sort((a, b) => (a.out - b.out) || b.total - a.total);
  let junk = null; // oyun sonunda elde kalan en değersiz (en eksi) eşya
  r.players.forEach(p => p.items.forEach(c => { if (c.value < 0 && (!junk || c.value < junk.card.value)) junk = { name: p.name, card: { name: c.name, img: c.img, value: c.value } }; }));
  r.stats = Object.assign(r.stats || {}, { junk });
  emit(r);
}

// ---- Oyuncu hamleleri (hem gerçek oyuncular hem botlar aynı fonksiyonları kullanır) ----
const A = {
  flip(r, me, { i }) {
    if (r.phase !== 'prep' || r.step !== 'flip' || me.id !== r.aud || !r.lot[i] || r.lot[i].up) return;
    const c = r.lot[i].card; r.lot[i].up = true; log(r, `Mezatçı bir eşyayı açtı: ${c.emoji} ${c.name}`);
    if (c.effect === 'wreck') { log(r, `TAHRİBAT! ${c.name} açığa çıktı, depo geçersiz.`); return finish(r, { text: `${c.name} açığa çıktı: depo ve tüm eşyalar geçersiz!`, reveal: c, at: i, fx: [`TAHRİBAT! ${c.name} açıldı.`] }); }
    r.step = 'peek'; arm(r); emit(r);
  },
  peek(r, me, { i }) {
    if (!r.lot || !r.lot[i] || r.lot[i].up) return;
    const put = () => { (r.peeks[me.id] = r.peeks[me.id] || {})[i] = r.lot[i].card; };
    if (r.phase === 'prep' && r.step === 'peek' && me.id === r.aud) { put(); return afterPrep(r); }
    if (['peekBefore', 'peekAfter'].includes(r.phase) && r.pending.includes(me.id)) {
      put(); r.pending = r.pending.filter(id => id !== me.id);
      if (r.pending.length) { arm(r); return emit(r); } donePeek(r);
    }
  },
  skipPeek(r, me) {
    if (!['peekBefore', 'peekAfter'].includes(r.phase) || !r.pending.includes(me.id)) return;
    r.pending = r.pending.filter(id => id !== me.id);
    if (r.pending.length) { arm(r); return emit(r); } donePeek(r);
  },
  joinAuction(r, me, { yes }, err = () => {}) {
    if (r.phase !== 'join' || r.order[r.ji] !== me.id) return;
    if (yes) {
      if (me.money < FEE) return err('Katılım ücreti için paran yok');
      me.money -= FEE; P(r, r.aud).money += FEE; r.joined.push(me.id); r.dec[me.id] = 'in';
    } else r.dec[me.id] = 'out';
    joinNext(r);
  },
  bid(r, me, { amt }, err = () => {}) {
    if (r.phase !== 'bid' || !r.bidders.includes(me.id)) return;
    amt = Math.floor(+amt);
    if (!(amt > 0) || amt % 100 || amt > 1e6) return err('Teklif 100$\'ın katı olmalı');
    if (amt <= r.bid.amt) return err('Teklif mevcut tekliften yüksek olmalı');
    if (r.bid.who === me.id) return;
    setBid(r, me.id, amt);
  },
  shield(r, me, { use }) {
    if (r.phase !== 'shield' || r.sale.winner !== me.id) return;
    resolve(r, use);
  },
  pay(r, me, { ids }, err = () => {}) {
    if (r.phase !== 'pay' || r.sale.winner !== me.id) return;
    ids = Array.isArray(ids) ? ids : [];
    if (sum(collateral(me).filter(c => ids.includes(c.id))) < r.sale.short) return err('Seçtiğin eşyaların değeri yetmiyor');
    settle(r, ids);
  },
};

function dropIfEmpty(room) {
  const humans = room.players.filter(p => !p.bot);
  if (!humans.length) { clear(room); delete rooms[room.code]; return true; }
  if (!humans.some(p => p.id === room.host)) room.host = humans[0].id;
  return false;
}
function addBot(r) {
  const used = r.players.filter(p => p.bot).map(p => p.name), [name, style] = BOTS.find(b => !used.includes(b[0])) || BOTS[0];
  r.players.push({ id: uid(), token: null, name, bot: true, style, money: 0, items: [], on: true, turnsLed: 0, eliminated: false, noise: 1, noiseTurn: -1 });
}

const onConn = sock => {
  let r, me;
  const err = m => sock.emit('err', m);
  const bind = (room, p) => { r = room; me = p; p.sid = sock.id; p.on = true; sock.emit('joined', { code: room.code, token: p.token }); emit(room); };
  const mk = name => ({ id: uid(), token: uid() + uid(), name: String(name || '').trim().slice(0, 14) || 'Oyuncu', money: 0, items: [], on: true, turnsLed: 0, eliminated: false });
  const newRoom = p => { let code; do { code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVYZ'[Math.floor(Math.random() * 21)]).join(''); } while (rooms[code]); return rooms[code] = { code, host: p.id, players: [p], phase: 'lobby', log: [], pending: [] }; };
  sock.on('create', ({ name } = {}) => { const p = mk(name); bind(newRoom(p), p); });
  sock.on('solo', ({ name, bots } = {}) => { // tek tuşla botlara karşı oyun
    const p = mk(name), room = newRoom(p); bind(room, p);
    const n = Math.max(MIN - 1, Math.min(MAX - 1, Math.floor(+bots) || 3));
    for (let i = 0; i < n; i++) addBot(room);
    startGame(room);
  });
  sock.on('join', ({ code, name } = {}) => {
    const room = rooms[String(code || '').toUpperCase().trim()];
    if (!room) return err('Oda bulunamadı');
    if (room.phase !== 'lobby') return err('Oyun zaten başlamış');
    if (room.players.length >= MAX) return err(`Oda dolu (en fazla ${MAX} oyuncu)`);
    const p = mk(name); room.players.push(p); bind(room, p);
  });
  sock.on('rejoin', ({ code, token } = {}) => {
    const room = rooms[code], p = room && token && room.players.find(x => x.token === token);
    if (!p) return sock.emit('forget');
    bind(room, p);
  });
  sock.on('addBot', () => {
    if (!r || r.host !== me.id || r.phase !== 'lobby') return;
    if (r.players.length >= MAX) return err(`Oda dolu (en fazla ${MAX} oyuncu)`);
    addBot(r); emit(r);
  });
  sock.on('removeBot', ({ id } = {}) => {
    if (!r || r.host !== me.id || r.phase !== 'lobby') return;
    r.players = r.players.filter(p => !(p.bot && p.id === id)); emit(r);
  });
  sock.on('start', () => {
    if (!r || r.host !== me.id || !['lobby', 'over'].includes(r.phase)) return;
    if (r.players.length < MIN) return err(`En az ${MIN} oyuncu gerekli`);
    startGame(r);
  });
  sock.on('leave', () => {
    if (!r || !me) return;
    const room = r, p = me; r = me = null; p.on = false; p.sid = null; p.token = null;
    if (room.phase === 'lobby' || room.phase === 'over') room.players = room.players.filter(x => x !== p);
    else { Object.assign(p, { bot: true, on: true, style: 'dengeli', noise: 1, noiseTurn: -1 }); p.name = p.name.slice(0, 11) + ' 🤖'; } // oyundan ayrılan yerine bot oynar
    if (!dropIfEmpty(room)) emit(room);
  });
  for (const ev of Object.keys(A)) sock.on(ev, d => { if (r && me) A[ev](r, me, d || {}, err); });
  sock.on('disconnect', () => {
    if (!me) return; const room = r, p = me; p.on = false; emit(room);
    setTimeout(() => {
      if (p.on || room.phase !== 'lobby' || !room.players.includes(p)) return;
      room.players = room.players.filter(x => x !== p);
      if (!dropIfEmpty(room)) emit(room);
    }, 60000);
  });
};
io.on('connection', onConn);

// ---- Botlar ----
const BOTS = [['Kurnaz Kemal', 'temkinli'], ['Dengeli Deniz', 'dengeli'], ['Gözü Kara Gül', 'gozukara'], ['Blöfçü Bora', 'gozukara'], ['Hesapçı Hale', 'temkinli'], ['Şanslı Selim', 'dengeli']];
const MARG = { temkinli: 0.55, dengeli: 0.85, gozukara: 1.15 }; // tahmin edilen değerin kaçına kadar teklif verir
const AVG = ITEMS.reduce((s, c) => s + c.value, 0) / ITEMS.length, WRECKS = ITEMS.filter(c => c.effect === 'wreck').length;
function botAct(r, p, idle) { // idle: süresi dolan/çevrimdışı gerçek oyuncu için güvenli varsayılan hamle
  const v = view(r, p), id = p.id;
  const closed = v.lot.map((l, i) => l.up ? -1 : i).filter(i => i >= 0), pick = () => closed[Math.floor(Math.random() * closed.length)];
  if (v.phase === 'prep' && v.aud === id) return A[v.step === 'flip' ? 'flip' : 'peek'](r, p, { i: pick() });
  if ((v.phase === 'peekBefore' || v.phase === 'peekAfter') && v.pending.includes(id)) return idle ? A.skipPeek(r, p, {}) : A.peek(r, p, { i: pick() });
  if (v.phase === 'shield' && v.shield) return A.shield(r, p, { use: v.shield.max });
  if (v.phase === 'pay' && v.pay.who === id) return A.pay(r, p, { ids: autoPick(p, v.pay.short) });
  if (idle) return v.phase === 'join' && v.cur === id ? A.joinAuction(r, p, { yes: false }) : undefined;
  if (p.noiseTurn !== r.turn) { p.noiseTurn = r.turn; p.noise = 0.85 + Math.random() * 0.3; }
  let known = 0, k = 0, wreck = false;
  v.lot.forEach(l => { if (!l.card) k++; else if (l.card.effect === 'wreck') wreck = true; else known += l.card.value; });
  const safe = Math.pow(1 - WRECKS / ITEMS.length, k); // bilinmeyen kartlarda Tahribat çıkmama ihtimali
  const cap = Math.min(wreck ? 0 : Math.round(safe * (known + k * AVG) * MARG[p.style] * p.noise / 100) * 100, worth(p));
  if (v.phase === 'join' && v.cur === id) return A.joinAuction(r, p, { yes: cap >= 300 && p.money >= FEE });
  if (v.phase === 'bid' && v.bidders.includes(id) && v.bid.who !== id) {
    const step = Math.max(100, Math.round(cap / 8 * (0.5 + Math.random()) / 100) * 100);
    const amt = Math.min(v.bid.amt ? v.bid.amt + step : 100 * (1 + Math.floor(Math.random() * 3)), cap);
    if (amt > v.bid.amt) A.bid(r, p, { amt });
  }
}
setInterval(() => Object.values(rooms).forEach(r => {
  if (!r.players.some(p => !p.bot && p.on)) { r.idle = r.idle || Date.now(); if (Date.now() - r.idle > 600000) { clear(r); delete rooms[r.code]; } return; } // 10 dk boş kalan oda silinir
  r.idle = 0;
  if (!['prep', 'peekBefore', 'peekAfter', 'join', 'bid', 'shield', 'pay'].includes(r.phase) || Date.now() < (r.hold || 0)) return;
  r.players.filter(p => p.bot && !p.eliminated).forEach(p => { if (Math.random() < 0.6) try { botAct(r, p); } catch (e) { console.error('bot', e); } });
}), 1000 * T);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Depo Savaşları hazır: http://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).forEach(i => console.log(`Telefondan: http://${i.address}:${PORT}`));
});
