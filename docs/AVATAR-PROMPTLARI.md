# Avatar görselleri – üretim rehberi

Oyun `avatars/01.webp` … `avatars/24.webp` dosyalarını **otomatik** bulur; hangisi varsa onu gösterir, olmayanlar için emoji kullanılır
(hepsini birden üretmen gerekmez, hazır oldukça klasöre at). Sunucuyu yeniden başlatman / push etmen yeterli, kod değişmez.

## Dosya kuralları
- **Ad:** `01.webp` … `24.webp` (iki haneli, sıra aşağıdaki listeyle aynı) · **Klasör:** proje kökünde `avatars/`
- **Boyut:** 256×256 px, WebP (kalite ~85). En büyük kullanım 84 px; 256 px 3× ekranlarda bile yeter
- **Köşeler düz arka plan rengi olmalı** (vinyet / gradyan / çerçeve yok): oyun, görselin sol üst köşe rengini **oyuncu rengi** olarak kullanır
  (koltuk kenarı, sıralama satırı, tepki balonu şeridi). Her avatarın arka plan rengi farklı olsun ki oyuncular renkten de ayırt edilsin
- **Yüz büyük ve net olsun:** küçük dairede (28–84 px) kırpılacak; yüz kadrajın ortasında, başın tepesi ve omuzlar görünsün
- Hepsi **aynı stilde** üretilmeli (aynı stil cümlesi, aynı araç/model)
- Gerçek kişi veya ünlü benzeri istenmesin; aile oyunu: sakin, neşeli ifadeler. Kullanım haklarını aracın şartlarından kontrol et

## Ortak stil cümlesi (her üretimde aynen kullan)
```
stylized flat-shaded game illustration, bold clean outlines, warm saturated colors, half-body portrait, friendly expression, face large and centered, plain solid [RENK] background with no gradient or shadow, 1:1, no text, no watermark
```
Prompt = `[karakter cümlesi], ` + ortak stil cümlesi (`[RENK]` yerine tablodaki rengi yaz).

## 01–06: Botlar (sıra sabit: kodda bot sırasıyla eşleşir)
| # | Bot | Karakter cümlesi | Arka plan |
|---|-----|------------------|-----------|
| 01 | Kurnaz Kemal | middle-aged man, curly black hair, thick mustache, sly narrow-eyed smirk, brown vest over a white shirt | orange |
| 02 | Dengeli Deniz | calm smiling woman in her thirties, short wavy brown hair, light blue sweater | raspberry pink |
| 03 | Gözü Kara Gül | confident fiery young woman, long wavy red hair, bold grin, red leather jacket | mustard yellow |
| 04 | Blöfçü Bora | man with a cowboy hat, stubble, sly sideways smile, denim jacket | sand tan |
| 05 | Hesapçı Hale | serious woman with round glasses, hair in a neat bun, white blouse, holding a small notepad | warm brown |
| 06 | Şanslı Selim | cheerful young man, messy hair, big laughing face, green t-shirt with a four-leaf clover | lavender purple |

## 07–24: Oyuncu avatarları (çeşitlilik: yaş, cinsiyet, ten, saç, aksesuar)
| # | Karakter cümlesi | Arka plan |
|---|------------------|-----------|
| 07 | grandmother with a white hair bun, round cheeks, warm smile, knitted cardigan | grey-blue |
| 08 | elderly man with a white beard and a flat cap, twinkling eyes | forest green |
| 09 | teenage girl with braces, ponytail and headphones around her neck, big smile | bright yellow |
| 10 | young man with dark skin, short afro, hoodie, relaxed smile | teal |
| 11 | woman with dark skin, voluminous curly hair, big gold earrings, joyful laugh | coral red |
| 12 | young man with light skin, ginger hair, freckles, glasses, cheeky grin | mint green |
| 13 | woman wearing a headscarf, gentle confident smile, olive skin, denim jacket | burgundy |
| 14 | man with a shaved head and a thick black beard, strong friendly smile, plaid shirt | sky blue |
| 15 | young woman with straight black hair and bangs, light skin, round pink glasses, playful smile | peach |
| 16 | boy about ten years old, missing front tooth, baseball cap, huge grin | lime green |
| 17 | girl about ten years old with two braids and a flower hairclip, curious smile | lilac |
| 18 | middle-aged woman with grey-streaked dark hair, reading glasses on a chain, kind smile, cardigan | dusty rose |
| 19 | man with tan skin, slicked-back dark hair, neat mustache, smart blazer, confident smile | navy blue |
| 20 | tall young woman with a blonde pixie cut, sporty jacket, energetic smile | turquoise |
| 21 | man in his sixties, bald with white sideburns, big laugh lines, suspenders over a shirt | olive green |
| 22 | young woman with long black braids, brown skin, colorful scarf, radiant smile | orange-red |
| 23 | chubby friendly man with a curly brown beard, chef's hat, proud smile | warm gold |
| 24 | woman with short silver hair, sharp cheekbones, elegant scarf, wise amused smile | slate grey |

## Üretimden sonra
1. Her görseli 256×256'ya küçült, WebP olarak kaydet, `avatars/NN.webp` adıyla koy (online araçlar: Squoosh, ImageMagick `magick in.png -resize 256x256 -quality 85 NN.webp`)
2. Yerelde `Oyunu Baslat.bat` ile aç; ana menüdeki avatar seçicide yüzlerin göründüğünü kontrol et
3. Sorun yoksa push et (`avatars/` klasörü de eklenmeli: `git add avatars`)

Oyun içinde: avatar seçici yüzleri 6 sütunlu ızgarada gösterir; ilk 6 yüz botlara aittir (oyuncular da seçebilir, bot o zaman bir sonraki boş yüzü alır).
