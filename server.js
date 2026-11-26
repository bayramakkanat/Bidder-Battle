const express = require('express'), http = require('http'), os = require('os');
const { Server } = require('socket.io');
const { ITEMS, STORAGES } = require('./data');
const app = express();
app.get('/', (q, s) => s.sendFile(__dirname + '/index.html'));
app.get('/healthz', (q, s) => s.send('ok')); // Render sağlık kontrolü
app.get('/durum', (q, s) => { // GitHub'a push'tan önce bak: şu an kaç oda / oyuncu aktif? Sadece sayılar (oda kodu ve oyuncu adı yok); safe = kimse çevrimiçi değil
  const live = Object.values(rooms).filter(r => r.players.some(p => !p.bot && p.on) || (r.specs || []).some(p => p.on));
  const n = live.reduce((t, r) => t + r.players.filter(p => !p.bot && p.on).length + (r.specs || []).filter(p => p.on).length, 0);
  s.set('Cache-Control', 'no-store').json({ rooms: live.length, playing: live.filter(r => !['lobby', 'over'].includes(r.phase)).length, players: n, safe: !live.length });
});
app.get('/cards.json', (q, s) => { // kart görsellerinin listesi (istemci arka planda önceden yükler)
  try { s.set('Cache-Control', 'public, max-age=3600').json([...new Set(require('fs').readdirSync(__dirname + '/cards').filter(f => /\.(jpe?g|webp|png)$/i.test(f)).map(f => f.replace(/\.webp$/i, '.jpg')))]); } catch (e) { s.json([]); }
});
app.get('/catalog.json', (q, s) => s.set('Cache-Control', 'public, max-age=300').json(CATALOG)); // "Kartlar" bölümü: tüm eşya / olay kartları ve depo çeşitleri (adetleriyle)
const CATALOG = { items: ITEMS.map(({ name, kind, value, effect, img }) => ({ name, kind, value, effect, img })), storages: Object.values(STORAGES.reduce((m, c) => { (m[c.name] = m[c.name] || { name: c.name, items: c.items, open: c.open, peek: c.peek, img: c.img, n: 0 }).n++; return m; }, {})) };
const STATIC = ['manifest.webmanifest', 'sw.js']; // sw.js ve manifest kökte kalmalı (PWA kapsamı); ikonlar icons/ altında
STATIC.forEach(f => app.get('/' + f, (q, s) => s.sendFile(__dirname + '/' + f, err => { if (err && !s.headersSent) s.status(404).end(); })));
const fs = require('fs');
app.use('/icons', express.static(__dirname + '/icons', { maxAge: '7d' }));
app.use('/cards', (q, s, next) => { // tarayıcı WebP destekliyorsa ve .webp dosyası varsa, .jpg isteklerine WebP gönder (görünüm aynı, boyut ~yarı)
  const m = /^\/([a-z0-9-]+)\.jpg$/i.exec(q.path);
  if (m && /image\/webp/.test(q.headers.accept || '') && fs.existsSync(__dirname + '/cards/' + m[1] + '.webp')) return s.set({ 'Vary': 'Accept', 'Cache-Control': 'public, max-age=604800' }).type('image/webp').sendFile(__dirname + '/cards/' + m[1] + '.webp');
  next();
});
app.use('/cards', express.static(__dirname + '/cards', { maxAge: '7d' }));
app.get('/avatars.json', (q, s) => { // avatars/01.webp … 24.webp: hangi avatarların görseli var (sıfır tabanlı sıra: 01 → 0). Yoksa istemci emoji kullanır
  try { s.set('Cache-Control', 'public, max-age=300').json(fs.readdirSync(__dirname + '/avatars').map(f => /^(\d{2})\.webp$/i.exec(f)).filter(Boolean).map(m => +m[1] - 1).filter(i => i >= 0 && i < NAV).sort((a, b) => a - b)); } catch (e) { s.json([]); }
});
app.use('/avatars', express.static(__dirname + '/avatars', { maxAge: '7d' }));
const server = http.createServer(app), io = new Server(server);

const MIN = +process.env.MIN_PLAYERS || 3, MAX = 7, START = 5000, FEE = 100, PENALTY = 1000;
const T = +process.env.TIME_SCALE || 1; // sadece test için: süreleri kısaltır
const ACT_MS = 25000 * T, OPEN_MS = 20000 * T, SELL_MS = 10000 * T, RESULT_MS = 9500 * T, PAY_MS = 30000 * T;
const rooms = {};
const SP = { yavas: 1.6, normal: 1, hizli: 0.65 }, spd = r => SP[r.speed] || 1; // oyun hızı: odadaki tüm süreleri çarpar
const REACTS = ['👏', '😂', '😱', '🔥', '😎', '💸', 'Bu benim!', 'Yüksek tutma!', 'Blöf mü?', 'Hızlı ol!', 'Aferin!', 'Hurda çıkacak 😏']; // hazır tepkiler (istemci sıra numarası gönderir)
const fmt = n => n.toLocaleString('tr-TR') + '$';
const uid = () => Math.random().toString(36).slice(2, 10);
const NAV = 24; // avatar sayısı (listesi ve emoji yedekleri istemcide: `AV`; görseller: avatars/01.webp … 24.webp). İlk 6 avatar botlara ayrılmıştır (`BOTS`)
function avFree(r, want, self) { // odada aynı avatar iki kişiye verilmez: istenen doluysa sıradaki boş olanı alınır
  const used = new Set(r.players.concat(r.specs || []).filter(p => p !== self).map(p => p.av));
  want = Number.isInteger(want) && want >= 0 && want < NAV ? want : 6 + Math.floor(Math.random() * (NAV - 6)); // rastgele avatar: ilk 6 (bot karakterleri) hariç
  for (let k = 0; k < NAV; k++) { const a = (want + k) % NAV; if (!used.has(a)) return a; }
  return want;
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const P = (r, id) => r.players.find(p => p.id === id);
const active = r => r.players.filter(p => !p.eliminated);
const log = (r, t) => { r.log.push(t); if (r.log.length > 30) r.log.shift(); };
const clear = r => { clearTimeout(r.timer); r.deadline = null; };
const later = (r, ms, fn) => { clear(r); r.deadline = Date.now() + ms; r.fn = fn; r.timer = setTimeout(fn, ms); };
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
    me: { id: me.id, name: me.name, money: me.money, items: me.items, spec: !!me.spec, rnd: !!me.rndAv }, nSpec: (r.specs || []).length,
    log: r.log.slice(-8), turn: r.turn, total: r.total, aud: r.aud, storage: r.storage, step: r.step,
    decks: { item: (r.itemDeck || []).length, storage: (r.storageDeck || []).length },
    players: r.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, on: p.on, out: p.eliminated, n: p.items.length, dec: r.dec && r.dec[p.id], av: p.av })),
    lot: (r.lot || []).map((l, i) => ({ up: l.up, card: vis(i) })),
    pending: r.pending || [], cur: r.phase === 'join' ? r.order[r.ji] : null,
    bidders: r.bidders || [], bid: r.phase === 'bid' ? r.bid : null,
    pay: r.phase === 'pay' ? { who: r.sale.winner, price: r.sale.price, short: r.sale.short } : null,
    res: r.phase === 'result' && r.res ? { text: r.res.text, fx: r.res.fx || [], winner: r.res.winner || null, n: r.res.n || 0, reveal: r.res.reveal || null, at: r.res.at, gain: r.res.winner === me.id ? r.res.gain : null } : null,
    shield, shieldWho: sale ? sale.winner : null, final: r.final, stats: r.phase === 'over' ? r.stats : null, series: r.phase === 'over' && r.series && r.series.games > 1 ? seriesView(r) : null, reacts: REACTS, diff: r.diff || 'normal', speed: r.speed || 'normal', paused: !!r.paused, ready: r.phase === 'result' ? Object.keys(r.ready || {}) : [],
  };
}
function seriesView(r) { // aynı odada peş peşe oyunların galibiyet sayıları (oyuncu ayrılsa bile kaydı kalır)
  const w = r.series.wins, ids = new Set([...r.players.map(p => p.id), ...Object.keys(w)]);
  return { games: r.series.games, rows: [...ids].map(id => { const p = P(r, id); return { id, name: p ? p.name : w[id].name, av: p ? p.av : w[id].av, n: w[id] ? w[id].n : 0 }; }).sort((a, b) => b.n - a.n) };
}
const emit = r => {
  const k = r.phase + ':' + r.turn; // yeni aşamada botlara animasyonlar için kısa bekleme süresi tanı
  if (r.seen !== k) { r.seen = k; r.hold = Date.now() + T * (r.phase === 'prep' ? 3000 : r.phase === 'result' ? 1500 : 700); }
  r.players.forEach(p => { if (p.on && p.sid && !p.bot) io.to(p.sid).emit('state', view(r, p)); });
  (r.specs || []).forEach(p => { if (p.on && p.sid) io.to(p.sid).emit('state', view(r, p)); }); // izleyiciler
};

const note = r => t => [...r.players, ...(r.specs || [])].forEach(p => { if (p.on && p.sid && !p.bot) io.to(p.sid).emit('note', t); }); // herkese kısa bildirim (ceza, eleme gibi önemli olaylar; günlük ekranda görünmediği için)
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
  later(r, ps.length && ps.every(p => p.bot || !p.on) ? 1500 : ACT_MS * spd(r), () => ps.forEach(p => { if (!p.bot) try { botAct(r, p, true); } catch (e) { console.error('auto', e); } }));
}

function startGame(r) {
  promoteSpecs(r); reshuffleAv(r);
  r.players.forEach(p => Object.assign(p, { money: START, items: [], eliminated: false, turnsLed: 0, won: 0 }));
  r.itemDeck = shuffle(ITEMS); r.discard = []; r.storageDeck = shuffle(STORAGES);
  r.gid = (r.gid || 0) + 1; r.turn = 0; r.total = r.players.length * 2; r.seat = Math.floor(Math.random() * r.players.length) - 1;
  r.log = []; r.final = null; r.sale = null; r.stats = { best: null, junk: null, bold: null }; nextTurn(r);
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
  r.phase = 'result'; r.res = res; r.ready = {}; r.resAt = Date.now(); later(r, RESULT_MS * spd(r), () => nextTurn(r)); emit(r);
}
function startBid(r, bidders) {
  r.phase = 'bid'; r.bidders = bidders.slice(); r.bid = { amt: 0, who: null, hist: [], n: r.bn = (r.bn || 0) + 1 };
  later(r, OPEN_MS * spd(r), () => bidTimeout(r)); emit(r); botPlan(r, null);
}
function setBid(r, id, amt, forced) {
  const prev = r.bid.who; r.bid.amt = amt; r.bid.who = id; r.bid.n = r.bn = (r.bn || 0) + 1; // n: botların bu teklife planladığı hamleler, teklif değişince geçersiz olur
  if (!r.bid.hot && amt >= 3000) { r.bid.hot = true; botSay(r, 'hot'); }
  r.bid.hist.unshift(`${P(r, id).name}: ${fmt(amt)}${forced ? ' (otomatik açılış)' : ''}`); r.bid.hist = r.bid.hist.slice(0, 5);
  later(r, SELL_MS * spd(r), () => bidTimeout(r)); emit(r); botPlan(r, prev);
}
function bidTimeout(r) { if (!r.bid.who) setBid(r, r.bidders[0], FEE, true); else sell(r); }

function sell(r) {
  const w = P(r, r.bid.who), price = r.bid.amt, short = Math.max(0, price - w.money);
  r.sale = { winner: w.id, price, short, cards: r.lot.map(l => l.card) };
  if (!short) return settle(r, []);
  if (sum(collateral(w)) < short) return failPay(r, w);
  // Para yetmiyor: eşyalar teminat olarak kullanılabilir (para üstü verilmez)
  r.phase = 'pay'; log(r, `${w.name} mezatı ${fmt(price)} ile kazandı; yetmeyen ${fmt(short)} için eşyalarını teminat gösteriyor...`);
  later(r, PAY_MS * spd(r), () => settle(r, autoPick(w, short))); emit(r);
}
function failPay(r, w) { // ödeyemedi: 1000$ ceza, mezat onsuz yeniden başlar
  const a = P(r, r.aud), { price } = r.sale;
  if (worth(w) >= PENALTY) {
    const cash = Math.min(w.money, PENALTY), rest = PENALTY - cash;
    w.money -= cash; a.money += cash; if (rest) take(w, a, autoPick(w, rest));
    log(r, `${w.name} ${fmt(price)} bedelini ödeyemedi, ${fmt(PENALTY)} ceza ödedi. Mezat ${w.name} olmadan baştan başlıyor.`);
    note(r)(`${w.name} ${fmt(price)} bedelini ödeyemedi: ${fmt(PENALTY)} ceza ödedi, mezat onsuz yeniden başlıyor.`);
  } else { a.money += w.money; w.money = 0; w.eliminated = true; w.items.forEach(c => r.discard.push(c)); w.items = []; log(r, `${w.name} ödeyemedi ve cezayı da karşılayamadı: oyundan elendi.`); note(r)(`${w.name} ${fmt(price)} bedelini ödeyemedi, cezayı da karşılayamadı: oyundan elendi.`); }
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
  w.won = (w.won || 0) + 1; if (r.stats && (!r.stats.bold || price > r.stats.bold.price)) r.stats.bold = { name: w.name, storage: r.storage.name, price, profit: deal.profit }; // rozetler: en cesur teklif, en çok mezat kazanan
  if (wreck) botSay(r, 'wreck'); // bot tepkileri
  else if (deal.profit > 1500) w.bot ? botSay(r, 'win', w.id) : botSay(r, 'good');
  else if (deal.profit < -500) botSay(r, 'junk');
  const text = `${w.name} mezatı ${fmt(price)} ile kazandı.`;
  log(r, text); fx.forEach(t => log(r, t));
  finish(r, { text, fx, winner: w.id, gain: held, n: held.length });
}
function endGame(r) {
  clear(r); r.phase = 'over';
  r.final = r.players.map(p => { const iv = sum(p.items); return { id: p.id, name: p.name, av: p.av, bot: !!p.bot, money: p.money, iv, total: p.money + iv, items: p.items, out: p.eliminated }; })
    .sort((a, b) => (a.out - b.out) || b.total - a.total);
  let junk = null; // oyun sonunda elde kalan en değersiz (en eksi) eşya
  r.players.forEach(p => p.items.forEach(c => { if (c.value < 0 && (!junk || c.value < junk.card.value)) junk = { name: p.name, card: { name: c.name, img: c.img, value: c.value } }; }));
  let collector = null, won = null; // rozetler: en çok hurda eline kalan (en az 2), en çok mezat kazanan (en az 2)
  r.players.forEach(p => { const n = p.items.filter(c => c.value < 0).length; if (n >= 2 && (!collector || n > collector.n)) collector = { name: p.name, n }; if ((p.won || 0) >= 2 && (!won || p.won > won.n)) won = { name: p.name, n: p.won }; });
  r.stats = Object.assign(r.stats || {}, { junk, collector, won });
  r.series = r.series || { games: 0, wins: {} }; r.series.games++; // seri skoru: beraberlikte herkese birer galibiyet yazılır
  const topT = r.final.length && !r.final[0].out ? r.final[0].total : null;
  if (topT !== null) r.final.filter(f => !f.out && f.total === topT).forEach(f => { const w = r.series.wins[f.id] = r.series.wins[f.id] || { n: 0 }; w.n++; w.name = f.name; w.av = f.av; });
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
  skip(r, me) { // sonuç ekranında "Devam": tüm (elenmemiş, çevrimiçi) gerçek oyuncular basınca sonraki tura geçilir
    if (r.phase !== 'result' || me.eliminated || Date.now() - (r.resAt || 0) < 1500 * T) return;
    r.ready[me.id] = true;
    if (r.players.filter(p => !p.bot && p.on && !p.eliminated).every(p => r.ready[p.id])) return nextTurn(r);
    emit(r);
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
  if (!humans.length) { (room.specs || []).forEach(s => { if (s.sid) io.to(s.sid).emit('forget', { room: false }); }); clear(room); delete rooms[room.code]; return true; }
  if (!humans.some(p => p.id === room.host)) room.host = humans[0].id;
  return false;
}
function promoteSpecs(r) { // yeni oyun başlarken izleyiciler (yer varsa) oyuncu olur
  const keep = [];
  for (const s of r.specs || []) {
    if (r.players.length < MAX) { delete s.spec; s.name = uniq(r, s.name); Object.assign(s, { money: 0, items: [], turnsLed: 0, eliminated: false }); r.players.push(s); } else keep.push(s);
  }
  r.specs = keep;
}
function reshuffleAv(r) { // "rastgele yüz" seçeneği açık oyuncular her yeni oyunda yeni bir yüz alır (ilk 6 bot yüzü hariç, odada çakışma olmaz)
  r.players.filter(p => p.rndAv && !p.bot).forEach(p => {
    const used = new Set(r.players.concat(r.specs || []).filter(x => x !== p).map(x => x.av)), free = [];
    for (let a = 6; a < NAV; a++) if (!used.has(a)) free.push(a);
    if (free.length) p.av = free[Math.floor(Math.random() * free.length)];
  });
}
function uniq(r, name) { // aynı odada aynı isimli oyuncu olmasın: "Oyuncu", "Oyuncu 2", "Oyuncu 3"...
  const has = n => r.players.concat(r.specs || []).some(p => p.name.toLowerCase() === n.toLowerCase());
  if (!has(name)) return name;
  for (let i = 2; ; i++) { const s = ' ' + i, n = name.slice(0, 14 - s.length).trimEnd() + s; if (!has(n)) return n; }
}
function addBot(r) {
  const used = r.players.map(p => p.name.toLowerCase()), b = BOTS.find(b => !used.includes(b[0].toLowerCase())) || BOTS[0], name = uniq(r, b[0]);
  const p = { id: uid(), token: null, name, bot: true, style: b[1], money: 0, items: [], on: true, turnsLed: 0, eliminated: false, noise: 1, noiseTurn: -1 };
  p.av = avFree(r, b[2], p); r.players.push(p);
}

const onConn = sock => {
  let r, me;
  const err = m => sock.emit('err', m);
  const bind = (room, p) => { r = room; me = p; p.sid = sock.id; p.on = true; sock.emit('joined', { code: room.code, token: p.token }); emit(room); };
  const mk = name => ({ id: uid(), token: uid() + uid(), name: String(name || '').trim().slice(0, 14) || 'Oyuncu', money: 0, items: [], on: true, turnsLed: 0, eliminated: false });
  const newRoom = p => { let code; do { code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVYZ'[Math.floor(Math.random() * 21)]).join(''); } while (rooms[code]); return rooms[code] = { code, host: p.id, players: [p], phase: 'lobby', log: [], pending: [] }; };
  sock.on('create', ({ name, av, rnd } = {}) => { const p = mk(name), room = newRoom(p); p.rndAv = !!rnd; p.av = avFree(room, rnd ? null : av, p); bind(room, p); });
  sock.on('solo', ({ name, bots, diff, speed, av, rnd } = {}) => { // tek tuşla botlara karşı oyun
    const p = mk(name), room = newRoom(p); p.rndAv = !!rnd; p.av = avFree(room, rnd ? null : av, p); bind(room, p); room.diff = DIFF[diff] ? diff : 'normal'; room.speed = SP[speed] ? speed : 'normal';
    const n = Math.max(MIN - 1, Math.min(MAX - 1, Math.floor(+bots) || 3));
    for (let i = 0; i < n; i++) addBot(room);
    startGame(room);
  });
  sock.on('join', ({ code, name, av, rnd } = {}) => {
    const room = rooms[String(code || '').toUpperCase().trim()];
    if (!room) return err('Oda bulunamadı');
    if (!['lobby', 'over'].includes(room.phase)) { // oyun sürüyor: izleyici olarak girer, sonraki oyunda oyuncu olur
      if ((room.specs || []).length >= 10) return err('İzleyici sınırı doldu (en fazla 10)');
      const sp = mk(name); sp.spec = true; sp.name = uniq(room, sp.name); sp.rndAv = !!rnd; sp.av = avFree(room, rnd ? null : av, sp); (room.specs = room.specs || []).push(sp); return bind(room, sp);
    }
    if (room.players.length >= MAX) return err(`Oda dolu (en fazla ${MAX} oyuncu)`);
    const p = mk(name); p.name = uniq(room, p.name); p.rndAv = !!rnd; p.av = avFree(room, rnd ? null : av, p); room.players.push(p); bind(room, p);
  });
  sock.on('rejoin', ({ code, token } = {}) => {
    const room = rooms[code], p = room && token && (room.players.find(x => x.token === token) || (room.specs || []).find(x => x.token === token));
    if (!p) return sock.emit('forget', { room: !!room }); // room: oda var ama oyuncu kayıtlı değil mi?
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
    if (p.spec) { room.specs = (room.specs || []).filter(x => x !== p); return emit(room); }
    if (room.phase === 'lobby' || room.phase === 'over') room.players = room.players.filter(x => x !== p);
    else Object.assign(p, { bot: true, on: true, style: 'dengeli', noise: 1, noiseTurn: -1 }); // oyundan ayrılan yerine bot oynar (adı ve avatarı kalır; botlarda 🤖 rozeti görünür)
    if (!dropIfEmpty(room)) emit(room);
  });
  sock.on('setDiff', ({ d } = {}) => { // bot zorluğu (sadece kurucu, oyun dışında)
    if (!r || r.host !== me.id || !['lobby', 'over'].includes(r.phase) || !DIFF[d]) return;
    r.diff = d; emit(r);
  });
  sock.on('setSpeed', ({ d } = {}) => { // oyun hızı (sadece kurucu, oyun dışında)
    if (!r || r.host !== me.id || !['lobby', 'over'].includes(r.phase) || !SP[d]) return;
    r.speed = d; emit(r);
  });
  sock.on('setAv', ({ av } = {}) => { // avatar değiştirme (lobide / oyun arasında; başkasının avatarı alınamaz)
    if (!r || !me || !['lobby', 'over'].includes(r.phase) || !Number.isInteger(av) || av < 0 || av >= NAV) return;
    if (r.players.concat(r.specs || []).some(p => p !== me && p.av === av)) return err('Bu avatar başkasında');
    me.av = av; emit(r);
  });
  sock.on('setAvRnd', ({ on } = {}) => { // "her oyunda rastgele yüz" seçeneği (lobide / oyun arasında); yeni oyun başlarken uygulanır (`reshuffleAv`)
    if (!r || !me || !['lobby', 'over'].includes(r.phase)) return;
    me.rndAv = !!on; emit(r);
  });
  sock.on('pause', ({ on } = {}) => { // duraklatma: sadece tek gerçek oyunculu (botlara karşı) odalarda
    if (!r || !me || me.spec || r.players.filter(p => !p.bot).length !== 1 || ['lobby', 'over'].includes(r.phase)) return;
    if (on && !r.paused) { r.paused = true; r.rem = Math.max(1000, (r.deadline || 0) - Date.now()); clearTimeout(r.timer); r.deadline = null; emit(r); }
    else if (!on && r.paused) { r.paused = false; later(r, r.rem, r.fn); emit(r); if (r.phase === 'bid') botPlan(r, null); }
  });
  sock.on('react', ({ i } = {}) => { // hazır tepki: odadaki gerçek oyunculara iletilir (1,2 sn'de bir)
    const t = REACTS[Math.floor(+i)];
    if (!r || !me || me.spec || !t || Date.now() - (me.lastReact || 0) < 1200) return;
    me.lastReact = Date.now();
    r.players.forEach(p => { if (p.on && p.sid && !p.bot) io.to(p.sid).emit('react', { id: me.id, name: me.name, av: me.av, t }); });
  });
  for (const ev of Object.keys(A)) sock.on(ev, d => { if (r && me && !me.spec && !r.paused) A[ev](r, me, d || {}, err); });
  sock.on('disconnect', () => {
    if (!me) return; const room = r, p = me; p.on = false; emit(room);
    if (p.spec) { setTimeout(() => { if (!p.on) { room.specs = (room.specs || []).filter(x => x !== p); emit(room); } }, 60000); return; }
    setTimeout(() => {
      if (p.on || room.phase !== 'lobby' || !room.players.includes(p)) return;
      room.players = room.players.filter(x => x !== p);
      if (!dropIfEmpty(room)) emit(room);
    }, 60000);
  });
};
io.on('connection', onConn);

// ---- Botlar ----
const BOTS = [['Kurnaz Kemal', 'temkinli', 0], ['Dengeli Deniz', 'dengeli', 1], ['Gözü Kara Gül', 'gozukara', 2], ['Blöfçü Bora', 'gozukara', 3], ['Hesapçı Hale', 'temkinli', 4], ['Şanslı Selim', 'dengeli', 5]]; // [ad, kişilik, avatar sırası (avatars/01..06.webp)]
const MARG = { temkinli: 0.55, dengeli: 0.85, gozukara: 1.15 }; // tahmin edilen değerin kaçına kadar teklif verir
// Zorluk: m = teklif çarpanı, n = tahmin hatası (büyüdükçe bot daha şaşırtıcı), act = bot her saniye hamle yapma olasılığı (reflekslerini belirler; teklif dışı hamleler), sn = son saniyede araya girme çarpanı, rs = tepki süresi çarpanı (küçük = daha çabuk)
const DIFF = { kolay: { m: 0.85, n: 0.7, act: 0.35, sn: 0.5, rs: 1.25 }, normal: { m: 1, n: 0.3, act: 0.6, sn: 1, rs: 1 }, zor: { m: 1.1, n: 0.1, act: 0.85, sn: 1.4, rs: 0.85 } };
// Teklif davranışı (kişiliğe göre; süreler saniye, normal hızda): open = açılış teklifini ne zaman verir, react = yeni bir teklife ne zaman karşılık verir, snipe = son saniyelerde araya girme olasılığı (bekleyip son anda teklif), bluff = o mezatta tahmin ettiği değerin ~%20 üstüne çıkma ve büyük sıçrama yapma olasılığı
const BEH = {
  temkinli: { open: [3, 9], react: [2.5, 5.5], snipe: 0.5, bluff: 0.04 },
  dengeli: { open: [2, 7], react: [1.6, 4.5], snipe: 0.3, bluff: 0.08 },
  gozukara: { open: [1.2, 4.5], react: [1.2, 3.5], snipe: 0.15, bluff: 0.18 },
};
// Bot tepkileri (kişiliğe göre): hot = teklif ısınınca, win = bot kazanınca, good = biri kazançlı çıkınca, junk = biri hurda alınca, wreck = Tahribat
const LINES = {
  hot: { temkinli: ['Bu fiyat çok yüksek!', 'Blöf mü?'], dengeli: ['💸', 'Hmm, ısınıyoruz!'], gozukara: ['Ben varım! 🔥', 'Daha yükseği var mı?'] },
  win: { temkinli: ['Hesabım tuttu 😎'], dengeli: ['Hayırlı olsun bana 😎'], gozukara: ['Bu benim! 🔥'] },
  good: ['👏', 'Aferin!', 'Vay be! 😮'], junk: ['😂', 'Hurda çıktı 😏', 'Eyvah!'], wreck: ['😱', 'Tahribat mı?!'],
};
function botSay(r, kind, only) { // rastgele bir bot (5 sn'de bir, %55 olasılıkla) kısa bir tepki gönderir
  const bots = r.players.filter(p => p.bot && !p.eliminated && (!only || p.id === only) && Date.now() - (p.lastSay || 0) > 5000);
  if (!bots.length || Math.random() > 0.55) return;
  const b = bots[Math.floor(Math.random() * bots.length)], L = LINES[kind], arr = Array.isArray(L) ? L : (L[b.style] || L.dengeli), t = arr[Math.floor(Math.random() * arr.length)];
  b.lastSay = Date.now();
  setTimeout(() => r.players.forEach(p => { if (p.on && p.sid && !p.bot) io.to(p.sid).emit('react', { id: b.id, name: b.name, av: b.av, t }); }), 800 + Math.random() * 1200);
}
const AVG = ITEMS.reduce((s, c) => s + c.value, 0) / ITEMS.length, WRECKS = ITEMS.filter(c => c.effect === 'wreck').length;
function botCap(r, p, v) { // botun bu depo için tahmini en yüksek teklifi (gördüğü kartlar + bilinmeyenlerin ortalaması, kişiliği, zorluğu); mezat başına bir kez blöf kararı verir
  const D = DIFF[r.diff] || DIFF.normal;
  if (p.noiseTurn !== r.turn) { p.noiseTurn = r.turn; p.noise = 1 + (Math.random() - 0.5) * D.n; p.bluff = Math.random() < (BEH[p.style] || BEH.dengeli).bluff; }
  let known = 0, k = 0, wreck = false;
  v.lot.forEach(l => { if (!l.card) k++; else if (l.card.effect === 'wreck') wreck = true; else known += l.card.value; });
  const safe = Math.pow(1 - WRECKS / ITEMS.length, k); // bilinmeyen kartlarda Tahribat çıkmama ihtimali
  return Math.min(wreck ? 0 : Math.round(safe * (known + k * AVG) * MARG[p.style] * D.m * p.noise / 100) * 100, worth(p));
}
function botPlan(r, prev) { // botların bu teklife ne zaman karşılık vereceğini planlar: anında değil; düşünme payı, bazen son saniyelerde araya girme (snipe)
  if (r.phase !== 'bid' || !r.bid || r.paused) return;
  const b = r.bid, stamp = b.n, k = T * spd(r) * 1000, left = Math.max(0, (r.deadline || 0) - Date.now()), D = DIFF[r.diff] || DIFF.normal;
  r.players.filter(p => p.bot && !p.eliminated && r.bidders.includes(p.id) && b.who !== p.id).forEach(p => {
    const B = BEH[p.style] || BEH.dengeli, hot = p.id === prev, rnd = ([lo, hi]) => (lo + Math.random() * (hi - lo)) * k; // hot: az önce geçilen bot daha çabuk karşılık verir
    let d;
    if (!b.who) d = rnd(B.open) * D.rs; // açılış: kimi çabuk, kimi bekler
    else if (Math.random() < Math.min(0.85, B.snipe * D.sn * (hot ? 0.6 : 1))) d = left - (0.8 + Math.random() * 2.4) * k; // son 0,8–3,2 sn'de araya girer
    else d = rnd(B.react) * D.rs * (hot ? 0.7 : 1);
    setTimeout(() => botBid(r, p, stamp), Math.max(d, 0.8 * k));
  });
}
function botBid(r, p, stamp) { // planlanan zamanda bot teklif verir (teklif / aşama değişmişse vazgeçer)
  const b = r.bid;
  if (r.phase !== 'bid' || r.paused || !b || b.n !== stamp || p.eliminated || b.who === p.id || !r.bidders.includes(p.id)) return;
  try {
    const cap = botCap(r, p, view(r, p)), limit = p.bluff ? Math.min(worth(p), Math.round(cap * 1.2 / 100) * 100) : cap; // blöf: tahmin ettiği değerin %20 üstüne kadar çıkabilir (kimse geçmezse fazla öder)
    const step = Math.max(100, Math.round(limit / 8 * (0.5 + Math.random()) / 100) * 100);
    let amt = b.who ? b.amt + step : 100 * (1 + Math.floor(Math.random() * 3));
    if (p.bluff && b.who && limit - b.amt >= 600 && Math.random() < 0.5) amt = b.amt + Math.round((limit - b.amt) * (0.35 + Math.random() * 0.3) / 100) * 100; // blöf: rakipleri korkutan büyük sıçrama
    amt = Math.min(amt, limit);
    if (amt > b.amt) A.bid(r, p, { amt });
  } catch (e) { console.error('botBid', e); }
}
function botAct(r, p, idle) { // idle: süresi dolan/çevrimdışı gerçek oyuncu için güvenli varsayılan hamle
  const v = view(r, p), id = p.id;
  const closed = v.lot.map((l, i) => l.up ? -1 : i).filter(i => i >= 0), pick = () => closed[Math.floor(Math.random() * closed.length)];
  if (v.phase === 'prep' && v.aud === id) return A[v.step === 'flip' ? 'flip' : 'peek'](r, p, { i: pick() });
  if ((v.phase === 'peekBefore' || v.phase === 'peekAfter') && v.pending.includes(id)) return idle ? A.skipPeek(r, p, {}) : A.peek(r, p, { i: pick() });
  if (v.phase === 'shield' && v.shield) return A.shield(r, p, { use: v.shield.max });
  if (v.phase === 'pay' && v.pay.who === id) return A.pay(r, p, { ids: autoPick(p, v.pay.short) });
  if (idle) return v.phase === 'join' && v.cur === id ? A.joinAuction(r, p, { yes: false }) : undefined;
  if (v.phase === 'join' && v.cur === id) { const cap = botCap(r, p, v); return A.joinAuction(r, p, { yes: cap >= 300 && p.money >= FEE }); }
  // teklifler burada değil, `botPlan` / `botBid` ile planlanan zamanda verilir (anlık tepki yok)
}
setInterval(() => Object.values(rooms).forEach(r => {
  if (!r.players.some(p => !p.bot && p.on)) { r.idle = r.idle || Date.now(); if (Date.now() - r.idle > 600000) { clear(r); delete rooms[r.code]; } return; } // 10 dk boş kalan oda silinir
  r.idle = 0;
  if (!['prep', 'peekBefore', 'peekAfter', 'join', 'shield', 'pay'].includes(r.phase) || Date.now() < (r.hold || 0) || r.paused) return;
  r.players.filter(p => p.bot && !p.eliminated).forEach(p => { if (Math.random() < (DIFF[r.diff] || DIFF.normal).act) try { botAct(r, p); } catch (e) { console.error('bot', e); } });
}), 1000 * T);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Depo Savaşları hazır: http://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).forEach(i => console.log(`Telefondan: http://${i.address}:${PORT}`));
});
