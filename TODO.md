# Depo Savaşları – Yapılacaklar

Durum: ✅ tamam · 🔧 yapılıyor · ⬜ sırada

## Tamamlananlar
- ✅ 59 eşya/olay kartı + 16 depo kartı doğrulandı, yeni yüksek kaliteli görseller (cards/) eklendi
- ✅ Deste çekme animasyonları, mezatçı papağan, mobil + masaüstü arayüz
- ✅ Botlara karşı (2–6 bot) ve online oda modu
- ✅ Teminat (eşyayla ödeme) kuralı, ceza ve eleme
- ✅ Tam ekran düğmesi (⛶ / F tuşu)

## Öncelik sırası
1. ✅ **Sunucuyu internete koymak** – `render.yaml`, `.gitignore`, `README.md`, `/healthz` hazır; kalan: GitHub + Render kurulumu (kullanıcı yapacak, adımlar README.md'de)
2. ✅ **PWA (telefona uygulama gibi kurulum)** – `manifest.webmanifest`, `sw.js`, `icon.svg` hazır; kalan: PNG simgeleri (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) klasöre koymak
3. ⬜ **Kart görünümü** – kenar yumuşatma, parlama, gölge
4. ⬜ **Oyun sonu ekranı** – kazanan kutlaması, "en iyi mezat" / "en büyük hurda" istatistikleri
5. ⬜ **Hazır tepkiler** – online oyunda tek tuşluk emoji / cümleler
6. ⬜ **Bot kişilikleri ve zorluk** – bot tepkileri, kolay / normal / zor
7. ⬜ **Bağlantı durumu** – "yeniden bağlanıyor" uyarısı

## Notlar
- Eski yedekler (`*.bak`) silinebilir: `server.js.bak`, `index.html.bak`, `data.js.bak`
- Vercel socket.io sunucusunu çalıştırmaz; Render / Railway / Fly.io kullanılmalı
