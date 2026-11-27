# Depo Savaşları – Durum ve Yapılacaklar

Son güncelleme: 2026-11-26 · Tüm maddeler elle denendi, açık hata yok.
(Eski ayrıntılı geliştirme günlüğü Git geçmişinde: önceki `TODO.md` sürümleri.)

## Yapılanlar

**Oyun ve kurallar**
- 59 eşya/olay kartı + 16 depo kartı, yüksek kaliteli görseller (WebP + JPG yedek)
- Botlara karşı (2–6 bot) ve online oda modu; en fazla 7 oyuncu
- Teminat (eşyayla ödeme), ödeyemeyene 1.000$ ceza ve eleme
- Bot kişilikleri ve zorluk (kolay / normal / zor); botlar insan gibi teklif verir (tepki süresi, son anda araya girme, blöf)
- Oyun hızı (yavaş / normal / hızlı), solo oyunda duraklatma, sonuç ekranında "Devam"
- İzleyici modu, aynı isimli oyuncular için otomatik numara, oda kaybı mesajı
- Hızlı tepkiler (12 hazır emoji / cümle), bot tepkileri

**Arayüz**
- Ana menü, lobi, oyun, sonuç ekranları (bilgisayarda iki sütun, telefonda tek sütun)
- Oyun ekranı pencereye göre ölçeklenir (`fitUI`), bilgisayarda kaydırma çubuğu yok
- 24 insan yüzlü avatar (ilk 6'sı botlara ayrılmış), "her oyunda rastgele yüz" seçeneği
- Sonuç ekranı: podyum, rozetler, seri skoru, sabit sütunlu sıralama
- Kartlar (katalog), eşya büyütmede gezinme, Eşyalarım penceresi, teminat penceresi
- İlk kez oynayanlar için ipucu kartı, okunurluk ve geniş monitör düzenlemeleri
- Avatar seçicide seçili avatar belirgin (büyük önizleme, altın çerçeve, ✓); o an mezatçı olan oyuncunun avatarı papağanın yanında; telefonda üst boşluk azaltıldı (2026-11-27, elle denenmedi)

**Ses**
- Ses efektleri, ses seviyesi, titreşim, isteğe bağlı mezat ambiyansı (müzik + sıklaşan tik)

**Altyapı**
- Render'da yayında (`render.yaml`, `/healthz`), PWA (telefona kurulum), bağlantı durumu şeridi
- Görsellerin arka planda önceden yüklenmesi, servis çalışanı önbelleği
- `/durum` adresi (push öncesi aktif oda kontrolü), `npm test` duman testi
- Klasör düzeni: `icons/`, `docs/`, `cards/`, `avatars/`

## Sırada
Şu an planlanmış bir iş yok. Fikir olursa buraya eklenir.

Şimdilik yapılmayacaklar (büyük iş / denge riski): hesap sistemi, sıralama tablosu, yeni kart türleri, yeni oyun modu. Önce mevcut kuralların oynanışta dengeli olup olmadığı görülmeli.

## Ayar noktaları (denge / his değiştirmek istersen)
- Bot teklif davranışı: `BEH` ve `DIFF` tabloları (`server.js`)
- Süreler: `ACT_MS`, `OPEN_MS`, `SELL_MS`, `RESULT_MS`, `PAY_MS`; hız çarpanları `SP`
- Ambiyans sesi: `sched` içindeki ses değerleri (`index.html`)
- Kart görsellerini 600 px'e küçültmek ~2 MB kazandırır ama zoom'da hafif kalite kaybı olur (yapılmadı)

## Dikkat edilecekler
- **Oyun sırasında GitHub'a push yapma:** sunucu yeniden başlar, aktif odalar silinir. Önce `https://<site>/durum` adresinde `safe: true` olmalı.
- Avatar sayısı `NAV` (`server.js`) ile `AV` (`index.html`) aynı olmalı (şu an 24). Görseller: `avatars/01.webp … 24.webp`.
- `sw.js` ve `manifest.webmanifest` kökte kalmalı (PWA kapsamı). Ön yüz dosyalarını değiştirince `sw.js` içindeki `V` sürümünü artırmak gerekmez (sayfalar önce ağdan gelir); sadece önbellekteki sabit dosyalar (ikonlar, avatarlar) değişirse artır.
- Vercel socket.io sunucusunu çalıştırmaz; Render / Railway / Fly.io kullanılmalı.
- Kart sayısı doğrudur: 59 eşya/olay + 16 depo (eski kılavuzdaki "56" hatalıydı).
- Her değişiklikten önce `npm test` çalıştırılabilir; sunucu değiştiyse yeniden başlat, tarayıcıda Ctrl+F5.
