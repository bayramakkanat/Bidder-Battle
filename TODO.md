# Depo Savaşları – Yapılacaklar

Durum: ✅ tamam · 🔧 yapılıyor · ⬜ sırada

## Tamamlananlar
- ✅ 59 eşya/olay kartı + 16 depo kartı doğrulandı, yeni yüksek kaliteli görseller (cards/) eklendi
- ✅ Deste çekme animasyonları, mezatçı papağan, mobil + masaüstü arayüz
- ✅ Botlara karşı (2–6 bot) ve online oda modu
- ✅ Teminat (eşyayla ödeme) kuralı, ceza ve eleme
- ✅ Tam ekran düğmesi (⛶ / F tuşu)

## Öncelik sırası
1. ✅ **Sunucuyu internete koymak** – `render.yaml`, `.gitignore`, `README.md`, `/healthz` hazır; GitHub + Render kurulumu tamamlandı
2. ✅ **PWA (telefona uygulama gibi kurulum)** – `manifest.webmanifest`, `sw.js`, `icon.svg` ve PNG simgeleri (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) hazır
3. ✅ **Kart görünümü** – kenar yumuşatma, parlama, gölge (`.face:after` / `.hc:after` katmanı, `index.html`)
4. ✅ **Oyun sonu ekranı** – kazanan kutlaması (konfeti + altın çerçeve), "en iyi mezat" (en yüksek kâr) ve "en büyük hurda" (oyun sonunda elde kalan en eksi eşya) istatistikleri; `server.js` `r.stats`
5. ✅ **Hızlı tepkiler** – HUD'daki 💬 düğmesi (odada en az 2 gerçek oyuncu varsa), 12 hazır emoji/cümle, ekranın üstünde 3 sn görünür; sunucuda `REACTS` listesi + 1,2 sn sınır
6. ✅ **Bot kişilikleri ve zorluk** – kolay / normal / zor (`DIFF` tablosu: teklif çarpanı, tahmin hatası, tepki hızı); solo menüde ve online lobide kurucu seçer; botlar kişiliğine göre tepki verir (`LINES`, `botSay`: teklif ısınınca, kazanınca, hurda / Tahribat çıkınca)
7. ✅ **Bağlantı durumu** – üstte "yeniden bağlanılıyor" / "Bağlandı" şeridi; bağlantı yokken hamleler gönderilmez; telefon uykudan dönünce hemen yeniden dener

## Öneriler (2026-11-23) – sırada
Öncelik: 🔴 oyun deneyimini en çok iyileştirir · 🟡 faydalı · 🟢 sonra
8. ✅ 🔴 **Depo kuralı özeti (yazıyla)** – depo kartının altında eşya sayısı / açık kart / gizlice bak etiketleri (`storageChips`, `index.html`). Eski açıklama: depo kartının altına kısa etiketler: "3 eşya · Açık kart: Evet · Gizlice bak: mezattan önce". Veri zaten var (`items`, `open`, `peek`); kart görselini okumaya gerek kalmaz
9. ✅ 🔴 **Duraklatma / süre ayarı** – solo oyunda ⏸ düğmesi (süre durur, hamleler reddedilir, "Devam et" ekranı); oyun hızı yavaş (×1,6) / normal / hızlı (×0,65): solo menüde, online lobide ve oyun sonunda kurucu seçer (`SP`, `spd(r)`, `server.js`). Eski açıklama: botlara karşı oyunda süre bitince oyuncu yerine otomatik hamle ("Katılma", "Bakma") yapılıyor; solo için duraklat düğmesi, online için kurucunun seçeceği oyun hızı (yavaş / normal / hızlı; süreler şu an sabit)
10. ✅ 🔴 **Otomatik duman testi** – `test-sim.js` (`npm install` sonra `npm test`): 3 zorlukta botlu oyun + 2 gerçek oyunculu online oda, tepkiler, para korunumu, yeni oyun. Eski açıklama: sadece botlarla (`TIME_SCALE` kısa) tam oyun oynatıp çökme / takılma bulan `test-sim.js`. 3-7. maddeler denenmeden yazıldı; her değişiklikten önce `node test-sim.js` ile kontrol edilebilir
11. ✅ 🟡 **Teklif geçmişi** – mezat panelinin altında "Son teklifler" listesi (en az 2 teklif olunca; kendi `#pH` alanı, yazılan özel teklif kutusu bozulmaz). Eski açıklama: sunucu son 5 teklifi tutuyor (`bid.hist`) ama ekranda gösterilmiyor; mezat panelinde küçük liste
12. ✅ 🟡 **Sonuç ekranını geçme** – sonuç panelinde "⏭ Devam" düğmesi (animasyonlar için ilk 2,5 sn pasif); tüm (elenmemiş, çevrimiçi) gerçek oyuncular basarsa hemen sonraki tur, çok oyunculuda "1/2" sayıcı (`A.skip`, `server.js`). Eski açıklama: her mezattan sonra 9,5 sn bekleniyor; tüm gerçek oyuncular "Devam" derse geçilsin
13. ✅ 🟡 **Oda kaybı mesajı** – yeniden bağlanınca oda yoksa (sunucu yeniden başlamış) "Oda artık yok" uyarısı (6 sn) + ana menüye dönüş; oda var ama oyuncu kaydı yoksa ayrı mesaj (`forget { room }`). Not: oyun sırasında GitHub'a push yapmak yine aktif odaları siler, sadece artık sessiz değil. Eski açıklama: odalar sunucu belleğinde; sunucu yeniden başlayınca (yeni push / dinlenme) oyuncu sessizce menüye atılıyor. "Oda artık yok" uyarısı ekle. Not: oyun sırasında GitHub'a push yapmak aktif odaları siler
14. ✅ 🟡 **Aynı isimli oyuncular** – aynı odada aynı ad gelirse "Oyuncu 2", "Oyuncu 3" gibi benzersiz yapılır (büyük/küçük harf farkı yok, 14 karakter sınırı korunur); botlar da oyuncu adıyla çakışmaz (`uniq`, `server.js`). Eski açıklama: ad boş bırakılınca herkes "Oyuncu" oluyor; "Oyuncu 2" gibi benzersiz yap
15. ✅ 🟡 **Görselleri önceden yükle** – sunucuda `/cards.json` (kart dosya listesi); istemci menü açıldıktan sonra tüm kartları arka planda 3'er 3'er yükler (veri tasarrufu açıksa yüklemez); servis çalışanı önbelleğe aldığından sonraki açılışlar anlık. WebP'ye çevirme: 67 görsel `cards/*.webp` olarak üretildi (kalite 85, tam çözünürlük, ~6,5 MB → ~3,3 MB; gözle fark yok). Sunucu, tarayıcı WebP kabul ediyorsa `.jpg` istene `.webp` gönderir (istemci kodu aynı kaldı); `.jpg` dosyalar yedek olarak kalabilir. 2 MB'a inmek için boyut 600 px'e küçültülmeli (zoom'da hafif kalite kaybı) – yapılmadı. Servis çalışanı önbelleği `bb-v2`. Eski açıklama: `cards/` toplam ~6 MB (67 dosya); yalnızca 3 görsel ön yüklemede, diğerleri ilk çekilince iniyor (yavaş bağlantıda boş kart). Menüdeyken arka planda kalanları yükle; istenirse görselleri küçültüp WebP'ye çevir
16. ⬜ 🟢 **Seri skor tablosu** – aynı odada peş peşe oyunlarda kimin kaç kez kazandığı (aile akşamı için)
17. ✅ 🟢 **İzleyici / geç katılma** – oyun sürerken odaya girenler engellenmez, İZLEYİCİ olur (en fazla 10; gizli kartları görmez, hamle yapamaz, üst çubukta "👀 İZLEYİCİ"); sonraki oyun başlayınca yer varsa otomatik oyuncu olur; oyun bitince ("over") gelen doğrudan oyuncu olarak katılır; sayfa yenilenince token ile geri bağlanır; oyunculara "👀 N izleyici" gösterilir (`room.specs`, `promoteSpecs`, `server.js`). Eski açıklama: oyun başlayınca katılamama ("Oyun zaten başlamış") yerine izleyici olarak girme
18. ⬜ 🟢 **Ses ayarları** – ses aç/kapat var; ses seviyesi ve titreşim aç/kapat ekle

## Notlar
- Kart sayısı 59 eşya/olay + 16 depo doğrudur (kılavuzdaki "56" kılavuz hatası, kullanıcı doğruladı).
- Vercel socket.io sunucusunu çalıştırmaz; Render / Railway / Fly.io kullanılmalı
