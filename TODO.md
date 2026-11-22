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

## Notlar
- Vercel socket.io sunucusunu çalıştırmaz; Render / Railway / Fly.io kullanılmalı
