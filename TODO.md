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
5. ⬜ **Hazır tepkiler** – online oyunda tek tuşluk emoji / cümleler
6. ⬜ **Bot kişilikleri ve zorluk** – bot tepkileri, kolay / normal / zor
7. ⬜ **Bağlantı durumu** – "yeniden bağlanıyor" uyarısı

## Notlar
- Eski yedekler (`*.bak`) silinebilir: `server.js.bak`, `index.html.bak`, `data.js.bak`
- Vercel socket.io sunucusunu çalıştırmaz; Render / Railway / Fly.io kullanılmalı
