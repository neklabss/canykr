# NVI Form Yardımcısı (Chrome/Edge MV3 eklentisi)

Görevlinin, müşterinin verdiği bilgileri yeniden yazmadan NVI **T.C. Kimlik No
Doğrulama** formuna aktarmasını sağlar.

> **Önemli:** Bu klasör **sıfırdan yazılmış yeni bir uygulamadır**. Önceki
> oturumda anlatılan prototip (ZIP) GitHub'da hiç bulunmadı ve bu kod ona
> dayanmıyor. Prototipin ZIP'i bulunursa iki sürüm karşılaştırılmalıdır.

## Ne yapar, ne yapmaz

| Yapar | Yapmaz |
| --- | --- |
| T.C. Kimlik No, Ad, Soyad ve Doğum Yılı alanlarını doldurur | Güvenlik kodunu (CAPTCHA) çözmez, atlatmaz, alanına dokunmaz |
| Dolu alanların değerini korur | Sorguyu başlatmaz, formu göndermez |
| Belirsiz alanları atlar ve bunu bildirir | Sonuç okumaz, otomatik karar vermez |
| readonly alanları (sanal klavye) bildirir | readonly / disabled durumunu zorla kaldırmaz |
| Kontrol basamağı ve biçim hatalarını yakalar | **Kimlik doğrulaması yapmaz.** "Dolduruldu" demek "kişi doğrulandı" demek değildir |

Güvenlik kodunu girip **Sorgula**'ya basmak ve sonucu NVI sayfasından okumak görevliye aittir.

## Kurulum (geliştirici modu)

1. `chrome://extensions` (Edge: `edge://extensions`) → **Geliştirici modu** açık.
2. **Paketlenmemiş öğe yükle** → bu `nvi-helper/` klasörünü seçin.
3. Araç çubuğundaki simgeye tıklayınca yan panel açılır.

## Kullanım

1. NVI'de T.C. Kimlik No Doğrulama sayfasını açın.
2. Yan panelde dört alanı doldurup **NVI formuna aktar**'a basın.
3. Paneldeki alan listesinde her alanın durumunu kontrol edin (Dolduruldu / Korundu / Belirsiz / Salt okunur …).
4. Güvenlik kodunu girip sorguyu kendiniz başlatın.

Sayfa henüz yükleniyorsa veri en fazla **2 dakika** bekletilir ve sayfa yüklenince doldurulur.

## Mimari

```
src/panel.html|js|css   Yan panel (erişilebilir form, hata özeti, canlı durum bölgesi)
src/background.js       Service worker: yeniden doğrulama, URL kontrolü, enjeksiyon, bekleyen kayıtlar
src/filler.js           Alan eşleştirme ve doldurma (sayfaya istek anında enjekte edilir)
src/validation.js       Biçim kontrolleri (kontrol basamağı, ad, yıl, tarih)
src/session-store.js    Sekmeye bağlı, TTL'li bekleyen kayıtlar (chrome.storage.session)
demo/                   Yerel demo (SİMÜLASYON)
test/                   Birim, tarayıcı ve uçtan uca testler
```

Akış: panel → `chrome.runtime.sendMessage({type:'nvi:fill'})` → service worker veriyi
yeniden doğrular, hedef sekmenin `https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula…`
olduğunu kontrol eder → `chrome.scripting.executeScript` ile `filler.js`'i yalnızca o
sekmeye enjekte eder → sonuç (yalnızca durum kodları, kişisel veri yok) panele döner.

### Alan eşleştirme kuralları

- Adaylar görünür `text/tel/number/search` input'larıdır. Etiket (`label[for]`, sarmalayan
  `label`, `aria-labelledby`), `id`, `name`, `placeholder`, `aria-label`, `title`
  Türkçe karakterlerden arındırılıp normalize edilir.
- Birebir eşleşme 3 puan, içerme 1 puandır; dışlama kelimeleri (ör. "Anne Adı", "Soyad"
  için "Ad") puanı sıfırlar. En yüksek puan birden fazla alandaysa alan **belirsiz** sayılır
  ve atlanır. Aynı input iki alana eşleşirse ikisi de belirsiz olur.
- "güvenlik", "captcha", "kod", "şifre" gibi kelimeleri taşıyan alanlar hiçbir koşulda doldurulmaz.
- Değer, sayfanın kendi `value` setter'ı ile yazılır, `input` ve `change` olayları tetiklenir;
  sonra değerin gerçekten kaldığı kontrol edilir (kalmadıysa `rejected`).
- Alanlar geç yüklenirse `MutationObserver` ile 8 saniyeye kadar beklenir.

## Gizlilik, izinler ve veri saklama

- **İzinler:** `storage`, `scripting`, `sidePanel`, `alarms`; host izni yalnızca
  `https://tckimlik.nvi.gov.tr/*`. `tabs` izni, kalıcı içerik betiği, uzak kod veya harici
  bağlantı (`externally_connectable`) yoktur.
- Panel verisi yalnızca panel sayfasının belleğindedir. Başarılı aktarımdan sonra (varsayılan),
  **Temizle** ile, 5 dakika boşta kalınca veya panel kapanınca silinir.
- Bekleyen kayıt yalnızca sekme henüz yüklenmiyorsa `chrome.storage.session`'a (diske yazılmaz,
  içerik betiklerine kapalı) yazılır. Doldurma yapılınca, sekme kapanınca, sekme NVI dışına
  gidince, **Temizle** ile veya **2 dakikalık** TTL dolunca silinir.
- Kişisel veri loglanmaz. Sonuç nesneleri yalnızca durum kodları içerir (testle doğrulanır).
- Service worker yalnızca eklentinin kendi panelinden gelen mesajları kabul eder.

## Demo (SİMÜLASYON)

```bash
npm run demo
```

`http://127.0.0.1:8765/` adresini açın. Sağdaki form **gerçek NVI sayfası değildir**;
alan yapısı tahminidir. Senaryolar: normal, önceden dolu alan, belirsiz alan, geç yüklenen
alanlar, hiç gelmeyen alanlar, sanal klavye (readonly), devre dışı alan, değeri reddeden
sayfa, yalnızca id'li alanlar, form yok. **Sentetik örnek veri** düğmesi kontrol basamağı
tutan rastgele bir numara üretir; gerçek kişi bilgisi girmeyin.

## Testler

Gereksinim: Node 18+ ve Playwright (Chromium). Bağımlılık kurulumu gerekmez; Playwright
global olarak kuruluysa doğrudan çalışır, değilse `npm i -D playwright && npx playwright install chromium`.

```bash
npm test             # hepsi
npm run test:unit    # validation + session-store (tarayıcısız)
npm run test:browser # filler + eklenti uçtan uca
```

- `test/validation.test.cjs` — kontrol basamakları, ad, yıl ve tarih kontrolleri.
  **Bunlar gerçek kimlik doğrulaması değildir.**
- `test/session-store.test.cjs` — TTL, tek kullanımlık okuma, sekme yalıtımı, temizlik.
- `test/filler.browser.test.cjs` — simülasyon formunda doldurma, değer koruma, belirsiz alan,
  geç yükleme, zaman aşımı, readonly/sanal klavye, disabled, reddedilen değer, CAPTCHA'ya ve
  gönder düğmesine dokunulmaması, sonuçta kişisel veri olmaması, demo sayfası.
- `test/extension.e2e.test.cjs` — eklenti gerçek Chromium'a yüklenir; `tckimlik.nvi.gov.tr`
  istekleri yerel simülasyon sayfasına yönlendirilir (gerçek NVI'ye istek gitmez, dış ağ
  istekleri engellenir ve test bunu doğrular). Kapsam: panelden aktarım, panel doğrulaması ve
  hata özeti, NVI dışı sekme / yanlış modül, yüklenirken bekletme, sekme kapanınca ve başka
  adrese gidince silme, iptal, **service worker kapatılıp yeniden başlatılınca bekleyen
  doldurmanın tamamlanması**, sanal klavye, zaman aşımı, kapalı sekme, erişilebilirlik temelleri.

## Canlı ortamda henüz doğrulanmayanlar

1. **Gerçek DOM ve seçiciler.** Canlı sayfa bu ortamdan erişilemedi. Alan adları kamuya açık
   kaynaklardan (NVI SOAP servisi: `TCKimlikNo`, `Ad`, `Soyad`, `DogumYili`) çıkarıldı;
   etiket metinleri tahmindir.
2. **Modül yolu** `/Modul/TcKimlikNoDogrula` topluluk kaynaklarından alındı (`src/background.js`
   içindeki `NVI_MODULE_PATH`). Yol farklıysa eklenti "Doğrulama modülü değil" der.
3. **Sanal klavye davranışı.** Alanları readonly yaptığı varsayıldı; gerçekte farklı olabilir
   (ör. alanlar gizlenip yerine başka öğe konabilir).
4. **Sayfanın kendi betikleri** `input`/`change` olaylarını farklı işleyebilir (maskeleme,
   blur doğrulaması). Değer kalmazsa `rejected` bildirilir ama gerçek davranış gözlenmedi.
5. **iframe.** Form bir iframe içindeyse şu an yalnızca ana çerçeve taranır.
6. Ad/soyad için büyük harf veya Türkçe yerel ayar dönüşümü gerekip gerekmediği bilinmiyor;
   değerler yazıldığı gibi aktarılır.

### Canlı DOM nasıl incelenir (kişisel veri girmeden)

Yetkili bir bilgisayarda NVI sayfasını açın, **hiçbir alana veri girmeden** geliştirici
araçları konsolunda:

```js
copy([...document.querySelectorAll('input,select,textarea,button,label')].map(e =>
  [e.tagName, e.type, e.id, e.name, e.placeholder, e.getAttribute('aria-label'),
   e.tagName === 'LABEL' ? e.textContent.trim() + ' → ' + e.htmlFor : '',
   e.readOnly, e.disabled, e.maxLength].join(' | ')).join('\n'))
```

Çıktıyı (yalnızca yapı, değer yok) paylaşın; ardından sanal klavye seçeneğini işaretleyip
aynı komutu tekrar çalıştırın. `FIELD_RULES` buna göre güncellenip simülasyon formu gerçek
yapıya yaklaştırılacak.

## Henüz yapılmayanlar / kapsam dışı

- **Gerçek müşteri paneli / backend entegrasyonu.** Panel adresi, API sözleşmesi ve kimlik
  doğrulama yöntemi netleşmeden yazılmayacak. Herkese açık veri köprüsü veya kimlik verisi
  içeren URL kullanılmayacak.
- **Sonuç okuma ve panelde otomatik karar.** Önce gerçek yanıt biçimi ve izinli entegrasyon
  yolu doğrulanmalı. Doldurma başarısı hiçbir yerde kimlik doğrulama başarısı olarak kaydedilmez.
- Simge dosyaları (varsayılan simge kullanılır).
