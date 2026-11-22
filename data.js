// Kart verileri (Depo Savaşları / Bidder Battle)
const slug = t => t.replace(/[çğıöşüİÇĞÖŞÜ]/g, c => 'cgiosuiCGOSU'['çğıöşüİÇĞÖŞÜ'.indexOf(c)]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const K = (kind, rows) => rows.map(([name, emoji, value, effect]) => ({ id: name, name, emoji, kind, value: value || 0, effect: effect || null, img: slug(name) }));

const ITEMS = [
  ...K('event', [['Sahte Altın', '🥇', 0, 'fraud'], ['Güvenlik Ağı', '🛡️', 0, 'shield'], ['Radyoaktif Atık', '☢️', 0, 'wreck'], ['Su Hasarı', '💦', 0, 'wreck'], ['Siyah Küf', '🦠', 0, 'wreck']]),
  ...K('collectible', [['Madeni Para Koleksiyonu', '🪙', 10000], ['Lüks Saat', '⌚', 10000], ['İkinci El Sedan', '🚗', 10000], ['Pul Koleksiyonu', '📖', 10000], ['Modern Tablo', '🖼️', 10000]]),
  ...K('scrap', [['Aşınmış Lastikler', '🛞', -100], ['Tüplü Televizyon', '📺', -100], ['Hasarlı Koşu Bandı', '🏃', -100], ['Bozuk Buzdolabı', '🧊', -500], ['Bitik Araba Aküleri', '🔋', -500], ['Kirli Yataklar', '🛏️', -500], ['Eski Model Jakuzi', '🛁', -500], ['Boş Ağır Kasa', '🗄️', -1000], ['Kırık Piyano', '🎹', -1000], ['İnşaat Molozu', '🧱', -2000]]),
  ...K('valuable', [['Düz Ekran Televizyon', '📺', 1000], ['Yüksek Teknolojili Fırın', '🍳', 1000], ['Elektro Gitar', '🎸', 1000], ['Koleksiyon Arabası', '🚙', 1000], ['Yıllanmış İskoç Viskisi', '🥃', 1000], ['Klasik Meşrubat Otomatı', '🥤', 2000], ['Şarap Soğutucusu', '🍷', 2000], ['Teleskop', '🔭', 2000], ['Spor Hatıra Eşyaları', '⚾', 3000], ['Antika Halı', '🧶', 3000], ['Profesyonel Hoparlörler', '🔊', 4000], ['3D Yazıcı', '🖨️', 5000], ['Araba Motoru', '⚙️', 6000], ['Antika Cep Saati', '🕰️', 7000], ['Altın Çerçeve', '🖼️', 8000], ['Antika Kılıç', '🗡️', 9000]]),
  ...K('common', [['Aile Fotoğrafları', '📸', 0], ['Cadılar Bayramı Süsleri', '🎃', 0], ['Mühürlü Aşk Mektubu', '💌', 0], ['Yapay Ağaç', '🪴', 100], ['Bebek Beşiği', '👶', 100], ['Plaklar', '💿', 200], ['Sörf Tahtası', '🏄', 200], ['Kano', '🛶', 300], ['Dizüstü Bilgisayar', '💻', 300], ['Klasik Çizgi Romanlar', '📚', 400], ['Alet Dolabı', '🧰', 400], ['Masaj Koltuğu', '💺', 500], ['Ağırlık Sehpası', '🏋️', 500], ['Şampiyonluk Kemeri', '🥊', 500], ['Porselen Köpek', '🐕', 500], ['Kondisyon Bisikleti', '🚴', 600], ['DJ Ekipmanı', '🎧', 600], ['Lüks Oto Koltukları', '🚘', 700], ['Bilardo Masası', '🎱', 700], ['Basketbol Ayakkabıları', '👟', 800], ['Beyzbol Kartları', '🃏', 800], ['Retro Video Oyunları', '🎮', 900], ['Pahalı Porselen Takımı', '🫖', 900]]),
];

// [ad, eşya sayısı, açık kart var mı, gizlice bak (before|after|never), adet]
const STORAGES = [
  ['Kilitli Dolap', 1, false, 'never', 2], ['Küçük', 2, false, 'after', 2], ['Orta', 3, false, 'before', 3],
  ['Büyük', 4, true, 'after', 4], ['Dev', 5, true, 'before', 5],
].flatMap(([name, items, open, peek, n]) => Array.from({ length: n }, () => ({ name, items, open, peek, img: 'depo-' + slug(name) })));

if (ITEMS.length !== 59 || STORAGES.length !== 16) throw new Error(`Kart sayısı hatalı: ${ITEMS.length} eşya/olay, ${STORAGES.length} depo`);
module.exports = { ITEMS, STORAGES };
