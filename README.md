# Depo Savaşları

Mezat tabanlı kart oyunu (Bidder Battle uyarlaması). 3–7 oyuncu; botlara karşı veya online.

## Bilgisayarda çalıştırma
`Oyunu Baslat.bat` dosyasına çift tıkla (Node.js gerekir). Tarayıcıda `http://localhost:3000` açılır.
Aynı Wi‑Fi'deki telefonlar, konsolda yazan "Telefondan: http://…" adresiyle girebilir.

## İnternete koyma (Render – ücretsiz)
Vercel socket.io sunucusunu çalıştıramaz; Render, Railway veya Fly.io kullan.

1. GitHub'da yeni bir **özel (private)** depo aç ve bu klasörü yükle. `node_modules` yüklenmez (`.gitignore` halleder).
   - `cards/` klasörü (yaklaşık 6 MB) mutlaka depoda olmalı.
2. <https://render.com> → **New ▸ Web Service** → GitHub deposunu seç.
   - Depodaki `render.yaml` ayarları kendisi doldurur: Build `npm install`, Start `npm start`.
3. Yayına alınca `https://depo-savaslari.onrender.com` gibi bir adres alırsın. Arkadaşların bu adresten girip oda koduyla katılır.
4. Not: Ücretsiz planda sunucu ~15 dk kullanılmazsa uyur; ilk açılış 30–60 sn sürebilir. Oyun sırasında kapanmaz.

### Hızlı deneme (kurulum yok)
Oyun bilgisayarında açıkken başka bir terminalde:
`cloudflared tunnel --url http://localhost:3000`
Verdiği `https://….trycloudflare.com` adresini arkadaşlarına gönder. Bilgisayar açık kaldığı sürece çalışır.

## Telefona uygulama gibi kurma (PWA)
- **Android (Chrome):** menü ▸ "Ana ekrana ekle / Uygulamayı yükle". Tam ekran açılır.
- **iPhone (Safari):** Paylaş ▸ "Ana Ekrana Ekle". Çubuksuz tam ekran açılır.
- PWA için `icons/` klasöründe `icon.svg`, `icon-192.png`, `icon-512.png` ve `apple-touch-icon.png` bulunmalı.
- Kurulum yalnızca **https** adreslerinde (Render / tünel) görünür; `localhost` dışında düz http'de çalışmaz.

## Dosyalar
| Dosya | Görev |
|---|---|
| `server.js` | Oyun kuralları, odalar, botlar (Node + socket.io) |
| `data.js` | Kart listesi (59 eşya/olay, 16 depo) |
| `index.html` | Tüm arayüz |
| `cards/` | Kart görselleri (`.webp` + `.jpg` yedek; kod `.jpg` ister, sunucu WebP gönderir) |
| `avatars/` | Oyuncu / bot yüzleri (`01.webp` … `24.webp`; ilk 6 botlara ayrılır) |
| `icons/` | PWA ve sekme simgeleri |
| `manifest.webmanifest`, `sw.js` | PWA (kökte kalmalı) |
| `test-sim.js` | Otomatik duman testi (`npm test`) |
| `render.yaml` | Render kurulum ayarı |
| `docs/TODO.md` | Yapılacaklar ve test listesi |
| `docs/AVATAR-PROMPTLARI.md` | Avatar üretim rehberi |
