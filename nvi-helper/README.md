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
- Alanlar geç yüklenirse 8 saniyeye kadar beklenir (service worker sayfayı ~400 ms aralıkla yoklar).
- **iframe:** Ana sayfa ve NVI host'undaki tüm iframe'ler önce değer gönderilmeden yoklanır
  (`NviFiller.probe`, yalnızca alan sayıları döner). Formu tek bir çerçeve taşıyorsa yalnızca
  o çerçeve doldurulur; birden fazla çerçevede form varsa **hiçbiri doldurulmaz**
  (`multiple_forms`). İzin olmayan (NVI dışı) iframe'lere enjeksiyon yapılmaz.

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
npm run test:browser # filler + check-dom + eklenti uçtan uca
```

CI: `.github/workflows/nvi-helper.yml`, `nvi-helper/` değiştiğinde aynı testleri çalıştırır
(Playwright yalnızca CI'da geçici kurulur, depoya bağımlılık eklenmez).

- `test/validation.test.cjs` — kontrol basamakları, ad, yıl ve tarih kontrolleri.
  **Bunlar gerçek kimlik doğrulaması değildir.**
- `test/session-store.test.cjs` — TTL, tek kullanımlık okuma, sekme yalıtımı, temizlik.
- `test/filler.browser.test.cjs` — simülasyon formunda doldurma, değer koruma, belirsiz alan,
  geç yükleme, zaman aşımı, readonly/sanal klavye, disabled, reddedilen değer, CAPTCHA'ya ve
  gönder düğmesine dokunulmaması, sonuçta kişisel veri olmaması, demo sayfası.
- `test/check-dom.test.cjs` — kaydedilmiş form HTML'ini raporlayan aracın testi.
- `test/extension.e2e.test.cjs` — eklenti gerçek Chromium'a yüklenir; `tckimlik.nvi.gov.tr`
  istekleri yerel simülasyon sayfasına yönlendirilir (gerçek NVI'ye istek gitmez, dış ağ
  istekleri engellenir ve test bunu doğrular). Kapsam: panelden aktarım, panel doğrulaması ve
  hata özeti, NVI dışı sekme / yanlış modül, yüklenirken bekletme, sekme kapanınca ve başka
  adrese gidince silme, iptal, iframe içindeki form, NVI dışı iframe, iki çerçevede form
  (doldurulmaz), geç yüklenen alanlar, **service worker kapatılıp yeniden başlatılınca bekleyen
  doldurmanın tamamlanması**, sanal klavye, zaman aşımı, kapalı sekme, erişilebilirlik temelleri.

Erişilebilirlik: panel (normal ve hata durumu) ve demo, açık ve koyu temada axe-core 4.10
(WCAG 2.1 A/AA + best-practice) ile tarandı; ihlal yok. axe-core depoya eklenmedi; tarama
elle tekrarlanmalı. Ekran okuyucuyla gerçek kullanım testi yapılmadı.

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
5. **iframe.** Form NVI host'undaki bir iframe içindeyse desteklenir; başka bir alan adından
   yüklenen iframe'deyse eklentinin izni olmadığı için doldurulamaz (bilerek).
6. Ad/soyad için büyük harf veya Türkçe yerel ayar dönüşümü gerekip gerekmediği bilinmiyor;
   değerler yazıldığı gibi aktarılır.

### Canlı DOM nasıl incelenir (kişisel veri girmeden)

Yetkili bir bilgisayarda NVI sayfasını açın. **Hiçbir alana veri girmeden** geliştirici
araçları konsolunda aşağıdakini çalıştırın. Sayfanın bir kopyasını alır; kopyadaki değerleri,
gizli alanları (ör. güvenlik belirteci), görselleri (CAPTCHA) ve betikleri temizler ve panoya
kopyalar:

```js
(() => {
  const root = document.body.cloneNode(true);
  root.querySelectorAll('script, noscript, iframe').forEach((e) => e.remove());
  root.querySelectorAll('img').forEach((e) => e.removeAttribute('src'));
  root.querySelectorAll('input, textarea').forEach((e) => {
    if (e.type === 'hidden') e.setAttribute('value', '');
    else if (!['checkbox', 'radio'].includes(e.type)) e.removeAttribute('value');
  });
  copy('<!doctype html><html lang="tr"><meta charset="utf-8"><body>' + root.innerHTML + '</body></html>');
})();
```

Panodaki içeriği `nvi-bos-form.html` olarak kaydedin. Sanal klavye seçeneğini işaretleyip aynı
komutla `nvi-sanal-klavye.html` dosyasını da kaydedin. Form bir iframe içindeyse konsolun üst
kısmındaki bağlam seçiciden o çerçeveyi seçip tekrar çalıştırın. Sonra:

```bash
npm run check-dom -- nvi-bos-form.html
```

Araç sayfa betiklerini çalıştırmadan ve ağa çıkmadan her alanın hangi input'a eşlendiğini,
eşleşmeyen alanları ve readonly/maxlength bilgisini yazar; dört alan da eşleşirse 0 ile çıkar.
Dosyalarda değer varsa uyarır. Bu dosyalar kişisel veri içermese de depoya **eklenmemelidir**;
paylaşılırsa `FIELD_RULES` ve simülasyon formu gerçek yapıya göre güncellenir.

## Henüz yapılmayanlar / kapsam dışı

- **Gerçek müşteri paneli / backend entegrasyonu.** Panel adresi, API sözleşmesi ve kimlik
  doğrulama yöntemi netleşmeden yazılmayacak. Herkese açık veri köprüsü veya kimlik verisi
  içeren URL kullanılmayacak.
- **Sonuç okuma ve panelde otomatik karar.** Önce gerçek yanıt biçimi ve izinli entegrasyon
  yolu doğrulanmalı. Doldurma başarısı hiçbir yerde kimlik doğrulama başarısı olarak kaydedilmez.
- Simge dosyaları (varsayılan simge kullanılır).
