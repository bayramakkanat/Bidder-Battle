// Duman testi: sunucuyu çok kısa sürelerle başlatır, otomatik oynayan istemcilerle tam oyunlar oynatır.
// Kullanım:  npm install   →   npm test      (veya: node test-sim.js)
// Amaç: çökme, takılma ve kural hatası (ör. paranın kaybolması) yakalamak. Render'a push etmeden önce çalıştır.
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const PORT = 3917, URL = `http://localhost:${PORT}`, START = 5000;
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failed++; };

// ---- Sunucu ----
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), TIME_SCALE: '0.03' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverErr = '';
srv.stderr.on('data', d => { serverErr += d; });
const ready = new Promise((res, rej) => {
  srv.stdout.on('data', d => { if (String(d).includes('hazır')) res(); });
  srv.on('error', rej); srv.on('exit', c => rej(new Error('Sunucu kapandı (kod ' + c + '): ' + serverErr)));
});

// ---- Otomatik oynayan istemci ----
const stateKey = s => [s.gid, s.turn, s.phase, s.step, s.cur, s.bid && s.bid.amt, s.bid && s.bid.who, (s.pending || []).length, s.shield ? 1 : 0, s.pay && s.pay.who].join(':');
function act(c) {
  const s = c.s;
  if (!c.auto || !s || ['lobby', 'over'].includes(s.phase)) return;
  const k = stateKey(s); if (c.k === k) return; c.k = k;
  const me = s.me, e = (ev, d) => c.sock.emit(ev, d || {});
  const closed = s.lot.map((l, i) => l.up ? -1 : i).filter(i => i >= 0);
  if (s.phase === 'prep' && s.aud === me.id) e(s.step === 'flip' ? 'flip' : 'peek', { i: closed[0] });
  else if ((s.phase === 'peekBefore' || s.phase === 'peekAfter') && s.pending.includes(me.id)) Math.random() < 0.5 ? e('peek', { i: closed[0] }) : e('skipPeek');
  else if (s.phase === 'join' && s.cur === me.id) e('joinAuction', { yes: me.money >= 100 && Math.random() < 0.7 });
  else if (s.phase === 'bid' && s.bidders.includes(me.id) && s.bid.who !== me.id && (s.bid.amt || 0) < 3000 && Math.random() < 0.6) e('bid', { amt: (s.bid.amt || 0) + 100 * (1 + Math.floor(Math.random() * 5)) });
  else if (s.phase === 'pay' && s.pay && s.pay.who === me.id) {
    let t = 0; const ids = [];
    for (const it of me.items.filter(x => x.value > 0).sort((a, b) => b.value - a.value)) { if (t >= s.pay.short) break; ids.push(it.id); t += it.value; }
    e('pay', { ids });
  } else if (s.phase === 'shield' && s.shield) e('shield', { use: s.shield.max });
  else if (s.phase === 'result' && c.skip) setTimeout(() => e('skip'), 100); // sonuç ekranında "Devam"
}
function client(name) {
  const c = { name, sock: io(URL, { forceNew: true, transports: ['websocket'] }), s: null, code: null, reacts: [], auto: false, skip: false, dts: [], rAt: 0, forgets: [] };
  c.sock.on('state', s => {
    if (s.phase === 'result') { if (!c.rAt) c.rAt = Date.now(); } else if (c.rAt) { c.dts.push(Date.now() - c.rAt); c.rAt = 0; } // sonuç ekranında geçen süre
    c.s = s; act(c);
  });
  c.sock.on('joined', d => { c.code = d.code; });
  c.sock.on('react', d => c.reacts.push(d));
  c.sock.on('forget', d => c.forgets.push(d));
  return c;
}
async function until(c, pred, ms, what) {
  const t0 = Date.now();
  while (!(c.s && pred(c.s))) {
    if (Date.now() - t0 > ms) throw new Error(`Zaman aşımı: ${what} (son aşama: ${c.s && c.s.phase}, tur ${c.s && c.s.turn}/${c.s && c.s.total})`);
    await wait(25);
  }
  return c.s;
}
function checkFinal(s, n, label) {
  const f = s.final;
  check(Array.isArray(f) && f.length === n, `${label}: ${n} oyuncunun sonucu var`);
  if (!f) return;
  const money = f.reduce((a, p) => a + p.money, 0);
  check(money === START * n, `${label}: toplam para korunmuş (${money} = ${START * n}) – para kaybolmamış/çoğalmamış`);
  check(f.every(p => Number.isFinite(p.total) && p.total === p.money + p.iv), `${label}: toplamlar sayı ve doğru`);
  check(s.stats && 'junk' in s.stats && 'best' in s.stats, `${label}: oyun sonu istatistikleri var`);
  const w = f.find(p => !p.out);
  console.log(`    kazanan: ${w ? w.name + ' ' + w.total + '$' : '-'} · en iyi mezat: ${s.stats.best ? s.stats.best.name + ' (+' + s.stats.best.profit + ')' : '-'} · hurda: ${s.stats.junk ? s.stats.junk.card.name : '-'}`);
}

async function main() {
  await ready;
  // 1) Botlara karşı: her zorlukta tam oyun
  for (const diff of ['kolay', 'normal', 'zor']) {
    console.log(`\nBotlara karşı oyun – ${diff}`);
    const c = client('Test'); c.auto = true;
    c.sock.emit('solo', { name: 'Test', bots: 3, diff });
    const s = await until(c, x => x.phase === 'over', 90000, 'oyun bitişi');
    check(s.diff === diff, `zorluk ${diff} olarak kaldı`);
    checkFinal(s, 4, diff);
    c.sock.close();
  }
  // 2) Duraklatma ve oyun hızı (botlara karşı)
  console.log('\nDuraklatma ve oyun hızı (botlara karşı)');
  {
    const c = client('Test');
    c.sock.emit('solo', { name: 'Test', bots: 3, diff: 'normal', speed: 'hizli' });
    await until(c, s => s.phase === 'prep', 5000, 'oyun başlangıcı');
    check(c.s.speed === 'hizli', 'oyun hızı seçilen değer olarak kaldı');
    c.sock.emit('pause', { on: true });
    const p = await until(c, s => s.paused, 3000, 'duraklatma');
    check(p.deadline === null, 'duraklatınca süre durdu');
    const snap = [p.phase, p.turn, p.log.length].join();
    c.sock.emit('peek', { i: 0 }); c.sock.emit('flip', { i: 0 });
    await wait(1800); // duraklatma çalışmasaydı bu sürede otomatik hamle gelirdi
    check([c.s.phase, c.s.turn, c.s.log.length].join() === snap && c.s.paused, 'duraklatılmışken oyun ilerlemedi, hamleler reddedildi');
    c.sock.emit('pause', { on: false });
    await until(c, s => !s.paused && s.deadline, 3000, 'devam');
    check(true, 'devam edince süre yeniden işledi');
    c.auto = true; act(c);
    const s = await until(c, x => x.phase === 'over', 90000, 'duraklatılan oyunun bitişi');
    checkFinal(s, 4, 'duraklatılmış oyun');
    c.sock.close();
  }
  // 3) Sonuç ekranını "Devam" ile geçme
  console.log('\nSonuç ekranını Devam ile geçme (yavaş hız: sonuç ekranı normalde ~456 ms)');
  {
    const c = client('Test'); c.auto = true; c.skip = true;
    c.sock.emit('solo', { name: 'Test', bots: 3, diff: 'normal', speed: 'yavas' });
    const s = await until(c, x => x.phase === 'over', 120000, 'Devam ile oynanan oyunun bitişi');
    const avg = c.dts.reduce((a, b) => a + b, 0) / (c.dts.length || 1);
    check(c.dts.length >= 6 && avg < 300, `sonuç ekranı erken geçildi (${c.dts.length} tur, ortalama ${Math.round(avg)} ms)`);
    checkFinal(s, 4, 'Devam ile hızlanan oyun');
    c.sock.close();
  }
  // 4) Oda kaybı: yeniden bağlanmada oda / oyuncu bulunamazsa "forget" gönderilir
  console.log('\nOda kaybı (rejoin)');
  {
    const a = client('A'), x = client('X');
    a.sock.emit('create', { name: 'A' });
    await until(a, s => s.phase === 'lobby', 5000, 'oda kurma');
    x.sock.emit('rejoin', { code: 'ZZZZ', token: 'abc' }); await wait(200);
    check(x.forgets.length === 1 && x.forgets[0].room === false, 'olmayan oda: "oda artık yok" bildirimi geldi');
    x.sock.emit('rejoin', { code: a.code, token: 'yanlis' }); await wait(200);
    check(x.forgets.length === 2 && x.forgets[1].room === true, 'oda var ama oyuncu kaydı yok: ayrı bildirim geldi');
    a.sock.close(); x.sock.close();
  }
  // 5) Online: iki gerçek oyuncu + bot, tepkiler, zorluk, yeni oyun
  console.log('\nOnline oda (2 oyuncu + 1 bot)');
  const a = client('A'), b = client('B');
  a.sock.emit('create', { name: 'A' });
  await until(a, s => s.phase === 'lobby', 5000, 'oda kurma');
  b.sock.emit('join', { name: 'B', code: a.code });
  await until(b, s => s.phase === 'lobby' && s.players.length === 2, 5000, 'odaya katılma');
  a.sock.emit('addBot');
  a.sock.emit('setDiff', { d: 'zor' });
  await until(a, s => s.diff === 'zor' && s.players.length === 3, 5000, 'bot ekleme / zorluk');
  check(a.s.players.every(p => Number.isInteger(p.av) && p.av >= 0 && p.av < 24) && new Set(a.s.players.map(p => p.av)).size === 3, 'her oyuncunun (botlar dahil) farklı bir avatarı var');
  const avList = await (await fetch(`${URL}/avatars.json`)).json();
  check(Array.isArray(avList) && avList.every(i => Number.isInteger(i) && i >= 0 && i < 24), `/avatars.json geçerli (${avList.length} avatar görseli var; 0 ise emoji yedeği kullanılır)`);
  check(a.s.players.filter(p => p.bot).every(p => p.av < 6), 'bot avatarları ilk 6 avatarın arasında (bota özel karakterler)');
  const meB = () => b.s.players.find(p => p.id === b.s.me.id), bAv = meB().av;
  b.sock.emit('setAv', { av: a.s.players[0].av }); await wait(150);
  check(meB().av === bAv, 'başkasında olan avatar seçilemedi');
  const free = [...Array(24).keys()].find(i => !a.s.players.some(p => p.av === i));
  b.sock.emit('setAv', { av: free }); b.sock.emit('setAv', { av: 99 }); await wait(150);
  check(meB().av === free, 'boş avatar seçilebildi, geçersiz değer yok sayıldı');
  a.sock.emit('setDiff', { d: 'çılgın' }); await wait(150);
  check(a.s.diff === 'zor', 'geçersiz zorluk reddedildi');
  b.sock.emit('setDiff', { d: 'kolay' }); await wait(150);
  check(a.s.diff === 'zor', 'kurucu olmayan zorluğu değiştiremedi');
  a.sock.emit('setSpeed', { d: 'yavas' }); await wait(150);
  check(a.s.speed === 'yavas', 'kurucu oyun hızını değiştirdi');
  a.sock.emit('setSpeed', { d: 'ışık' }); b.sock.emit('setSpeed', { d: 'hizli' }); a.sock.emit('pause', { on: true }); await wait(150);
  check(a.s.speed === 'yavas' && !a.s.paused, 'geçersiz / yetkisiz hız ve lobide duraklatma reddedildi');
  a.sock.emit('react', { i: 0 }); await wait(200);
  check(b.reacts.length === 1 && b.reacts[0].name === 'A', 'tepki diğer oyuncuya ulaştı');
  a.sock.emit('react', { i: 1 }); await wait(200);
  check(b.reacts.length === 1, 'arka arkaya tepki sınırlandı');
  a.sock.emit('react', { i: 999 }); a.sock.emit('react', {}); await wait(100);
  const dur = await (await fetch(`${URL}/durum`)).json();
  check(Object.keys(dur).sort().join() === 'playing,players,rooms,safe' && dur.rooms >= 1 && dur.players >= 2 && dur.safe === false && !JSON.stringify(dur).includes(a.code), `/durum yalnızca sayılar veriyor (${dur.rooms} oda, ${dur.players} çevrimiçi), oda kodu yok, aktif oda varken safe=false`);
  b.sock.emit('setAvRnd', { on: true }); await wait(150);
  check(b.s.me.rnd === true && a.s.me.rnd === false, 'rastgele yüz seçeneği sadece açan oyuncuda açık');
  const aAv0 = a.s.players.find(p => p.id === a.s.me.id).av, bAv0 = meB().av;
  a.auto = b.auto = true;
  a.sock.emit('start');
  const s1 = await until(a, s => s.phase === 'over', 90000, 'online oyun bitişi');
  checkFinal(s1, 3, 'online');
  check(meB().av >= 6 && meB().av !== bAv0 && a.s.players.find(p => p.id === a.s.me.id).av === aAv0 && new Set(a.s.players.map(p => p.av)).size === 3, 'rastgele yüz: B yeni oyunda yeni bir yüz aldı (ilk 6 hariç), A\'nın avatarı sabit kaldı, çakışma yok');
  const gid = s1.gid;
  check(s1.series === null, 'ilk oyundan sonra seri skoru gösterilmiyor (tek oyun)');
  a.sock.emit('start');
  const s2 = await until(a, s => s.gid === gid + 1 && s.phase !== 'over', 5000, 'yeni oyun');
  check(s2.stats === null && s2.turn >= 1, 'yeni oyun temiz başladı');
  const s3 = await until(a, s => s.gid === gid + 1 && s.phase === 'over', 90000, 'ikinci online oyunun bitişi');
  const wins = s3.series ? s3.series.rows.reduce((t, r) => t + r.n, 0) : 0;
  check(!!s3.series && s3.series.games === 2 && s3.series.rows.length === 3 && wins >= 2, `seri skoru: 2 oyun, 3 oyuncu, ${wins} galibiyet kayıtlı`);
  check(!!s3.series && s3.series.rows.every((r, i, ar) => !i || ar[i - 1].n >= r.n), 'seri skoru galibiyet sayısına göre sıralı');
  a.sock.close(); b.sock.close();
  check(!serverErr.trim(), 'sunucu hata yazmadı' + (serverErr.trim() ? '\n' + serverErr : ''));
}

const dog = setTimeout(() => { console.error('\n✗ Genel zaman aşımı'); srv.kill(); process.exit(1); }, 5 * 60 * 1000);
main().catch(e => { console.error('\n✗ ' + e.message); failed++; }).finally(() => {
  clearTimeout(dog); srv.kill();
  console.log(failed ? `\n${failed} kontrol BAŞARISIZ` : '\nTüm kontroller başarılı ✓');
  process.exit(failed ? 1 : 0);
});
