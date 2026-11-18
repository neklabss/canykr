# NVI Form Yardımcısı (Chrome/Edge MV3 eklentisi)

Görevlinin, müşterinin verdiği bilgileri yeniden yazmadan NVI **T.C. Kimlik No
Doğrulama** formuna aktarmasını sağlar.

> **Önemli:** Bu klasör **sıfırdan yazılmış yeni bir uygulamadır**. Önceki
> oturumda anlatılan prototip (ZIP) GitHub'da hiç bulunmadı ve bu kod ona
> dayanmıyor. Prototipin ZIP'i bulunursa iki sürüm karşılaştırılmalıdır.

## Ne yapar, ne yapmaz

| Yapar | Yapmaz |
| --- | --- |
| T.C. Kimlik No, Adı, Soyad, Doğum Gün, Doğum Ay ve Doğum Yılı alanlarını doldurur | "Ben robot değilim" (reCAPTCHA) kutusuna dokunmaz, çözmez, atlatmaz |
| Nüfus cüzdanı / kimlik kartı / geçici belge seri no alanlarına ve "Soyadı Nüfus Kayıtlarında Yok" kutusuna dokunmaz | |
| Dolu alanların değerini korur | Sorguyu başlatmaz, formu göndermez |
| Belirsiz alanları atlar ve bunu bildirir | Sonuç okumaz, otomatik karar vermez |
| readonly alanları (sanal klavye) bildirir | readonly / disabled durumunu zorla kaldırmaz |
| Kontrol basamağı ve biçim hatalarını yakalar | **Kimlik doğrulaması yapmaz.** "Dolduruldu" demek "kişi doğrulandı" demek değildir |

**"Ben robot değilim"** kutusunu işaretlemek, **Doğrula**'ya basmak ve sonucu NVI sayfasından
okumak görevliye aittir.

## Gerçek sayfa hakkında bilinenler

### Canlı sayfanın salt okunur incelemesi (18.11.2026, `scripts/inspect-live.cjs`)

Sayfa, NVI'ye erişebilen bir bilgisayarda Playwright ile açıldı ve boş form salt okunur
incelendi. Hiçbir alana yazılmadı, hiçbir şey gönderilmedi.

| Bilgi | Canlı sayfada |
| --- | --- |
| Adres / başlık | `https://tckimlik.nvi.gov.tr/Modul/TcKimlikNoDogrula`, "T.C. Kimlik No Doğrulama - Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü" |
| Çatı | Angular 4.4.7 (`ng-version`), alanlarda `form-control ng-untouched ng-pristine ng-invalid`; form `novalidate`, `method="get"` |
| Zorunlu alanlar (etiketler `<label>` ile bağlı) | `requestTCKimlikNo` "T.C. Kimlik No" (maxlength 11), `requestAd` "Adı", `requestSoyad` "Soyad", `requestDogumGun` "Doğum Gün" (2), `requestDogumAy` "Doğum Ay" (2), `requestDogumYil` "Doğum Yılı" (4) |
| İsteğe bağlı | `chkSoyadYok` "Soyadı Nüfus Kayıtlarında Yok." (onay kutusu), `requestCuzdanSeriNo`, `requestTckkSeriNo` "Seri No", `requestGeciciKimlikNo` "Geçici Kimlik Belge No" |
| Güvenlik | Google reCAPTCHA (`g-recaptcha-response` textarea + google.com iframe'leri), **Doğrula** düğmesi (`button.btn.btn-info`) |
| Sanal klavye | `<div class="sanalKlavye" tooltip="Sanal Klavye Kullan">`; tıklanınca yalnızca `active` sınıfı eklenir. **Alanlar salt okunur olmaz.** |
| Diğer | F5 bot koruması (`/TSPD/`) gizli çerçeveler ekler (alan yok); çerez bandında "Kabul et" düğmesi var; sayfa `String.prototype.toLowerCase`'i Türkçe kurala göre değiştiriyor (`I` → `ı`) |

Sonuç: eklentinin alan eşleştirmesi canlı DOM'da altı alanın altısını doğru buldu, belirsizlik
yoktu. Bu bulgular üzerine:
- sanal klavye algılaması `div.sanalKlavye.active` biçimine göre düzeltildi,
- normalizasyon ASCII `I` için sağlamlaştırıldı,
- T.C. Kimlik No kuralına "geçici" dışlaması eklendi (`requestGeciciKimlikNo` zayıf aday oluyordu),
- simülasyon formu gerçek id'ler, TSPD çerçevesi ve çerez bandıyla güncellendi.

### Resmi kılavuz

NVİ'nin [tckimlik.nvi.gov.tr Kullanıcı Kılavuzu](https://tckimlik.nvi.gov.tr/Pages/Help/TCKIMLIK_KULLANICI_KILAVUZU.pdf)
(18.08.2020, bölüm 1.2.1) aynı alanları ve sırayı gösterir. Kılavuza göre "Ben robot değilim"
işaretlenip Doğrula'ya basılır. Zorunlu alan boş bırakılırsa, biçim yanlışsa ya da kayıt
bulunamazsa sistem uyarı verir.

Bu geliştirme ortamından (bulut) sayfa açılamıyor; sunucu bağlantıyı yanıtsız kesiyor.
İnceleme bu yüzden kullanıcının bilgisayarında yapıldı.

## Kurulum (geliştirici modu)

1. `chrome://extensions` (Edge: `edge://extensions`) → **Geliştirici modu** açık.
2. **Paketlenmemiş öğe yükle** → bu `nvi-helper/` klasörünü seçin.
3. Araç çubuğundaki simgeye tıklayınca yan panel açılır. Önerilen kısayol **Alt+Shift+N**'dir;
   tarayıcı başka bir eklentiyle çakışma nedeniyle atamazsa `chrome://extensions/shortcuts`
   (Edge: `edge://extensions/shortcuts`) sayfasından elle atanabilir. (Kısayolun gerçek
   tarayıcıda atandığı doğrulanmadı; otomatik test tarayıcısı önerilen tuşu atamıyor.)

Başka bilgisayarlara dağıtmak için `npm run pack` yalnızca çalışma dosyalarını (manifest ve
`src/`) içeren `dist/nvi-helper-<sürüm>.zip` üretir; demo ve testler pakete girmez. Zip açılıp
aynı şekilde "Paketlenmemiş öğe yükle" ile kurulur. Kurumsal zorunlu kurulum (Chrome/Edge
politikası veya mağaza) için ayrıca imzalı paket ve barındırma kararı gerekir.

## Kullanım

1. NVI'de T.C. Kimlik No Doğrulama sayfasını açın. Panelin üstündeki gösterge etkin sekmenin
   doğru sayfa olup olmadığını söyler (yalnızca bilgi amaçlıdır; asıl kontrol aktarım anında
   service worker'da yapılır).
2. Yan panelde T.C. Kimlik No, Ad, Soyad ve **Doğum Tarihi**'ni (GG.AA.YYYY) doldurun **ya da** müşteri bilgisini (mesaj, e-posta, tablo satırı)
   **Yapıştırarak doldur** kutusuna yapıştırıp **Alanlara dağıt**'a (veya Ctrl+Enter) basın.
   Etiketsiz metinden tahmin edilen alanlar kesikli çerçeveyle işaretlenir; kontrol edin.
   Yapıştırılan ham metin ayrıştırıldıktan hemen sonra silinir. Yapıştırma NVI formuna
   **yazmaz**, yalnızca panel alanlarını doldurur.
3. **NVI formuna aktar**'a basın.
4. Paneldeki alan listesinde her alanın durumunu kontrol edin (Dolduruldu / Korundu / Belirsiz / Salt okunur …).
5. "Ben robot değilim" kutusunu işaretleyip **Doğrula**'ya kendiniz basın.

Doğum tarihi tam girilirse gün, ay ve yıl ayrı alanlara yazılır. Yalnızca yıl girilirse yalnızca
Doğum Yılı doldurulur. Gün ve ay için panel "elle girin" der ve sonuç "bazı alanlar aktarılamadı"
olur.

Sayfa henüz yükleniyorsa veri en fazla **2 dakika** bekletilir ve sayfa yüklenince doldurulur.

## Mimari

```
src/panel.html|js|css   Yan panel (erişilebilir form, hata özeti, canlı durum bölgesi)
src/background.js       Service worker: yeniden doğrulama, URL kontrolü, enjeksiyon, bekleyen kayıtlar
src/filler.js           Alan eşleştirme ve doldurma (sayfaya istek anında enjekte edilir)
src/validation.js       Biçim kontrolleri (kontrol basamağı, ad, doğum tarihi → gün/ay/yıl)
src/nvi-url.js          NVI adres sınıflandırması (service worker ve panel göstergesi)
src/paste-parser.js     Yapıştırılan serbest metinden alan ayrıştırma (yalnızca panelde)
src/session-store.js    Sekmeye bağlı, TTL'li bekleyen kayıtlar (chrome.storage.session)
scripts/inspect-live.cjs  Canlı sayfanın boş formunu Playwright ile salt okunur inceleme
scripts/check-dom.cjs     Kaydedilmiş boş form HTML'inde eşleştirme raporu
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
- Bağlı etiket yoksa alanın (en fazla 4 üst öğe yukarıya kadar) **önündeki metin** etiket sayılır
  (ör. `<div>Doğum Ay</div><div><input></div>`). Aradaki öğe başka bir alan içeriyorsa o metin ona
  aittir. Kılavuzdaki düzen tablo/sütun biçiminde olduğu için bu yedek eklendi.
- Bağlı etiket ya da özellik birebir eşleşirse 3 puan, yakın metin birebir eşleşirse 2 puan,
  içerme 1 puan alınır. Dışlama kelimeleri (ör. "Soyad" için "Ad", "Doğum Yılı" için "Gün/Ay")
  puanı sıfırlar. En yüksek puan birden fazla alandaysa alan **belirsiz** sayılır
  ve atlanır. Aynı input iki alana eşleşirse ikisi de belirsiz olur.
- "güvenlik", "captcha", "kod", "şifre" gibi kelimeleri taşıyan alanlar hiçbir koşulda doldurulmaz.
  Onay kutuları ("Soyadı yok", "Ben robot değilim") ve "Seri No" alanları aday değildir.
- Gün ve ay iki haneli yazılır (`05`, `03`). Sayfanın tek haneli değer bekleyip beklemediği
  doğrulanmadı.
- Değer, sayfanın kendi `value` setter'ı ile yazılır, `input` ve `change` olayları tetiklenir;
  sonra değerin gerçekten kaldığı kontrol edilir (kalmadıysa `rejected`).
- Alanlar geç yüklenirse 8 saniyeye kadar beklenir (service worker sayfayı ~400 ms aralıkla yoklar).
- **iframe:** Ana sayfa ve NVI host'undaki tüm iframe'ler önce değer gönderilmeden yoklanır
  (`NviFiller.probe`, yalnızca alan sayıları döner). Formu tek bir çerçeve taşıyorsa yalnızca
  o çerçeve doldurulur; birden fazla çerçevede form varsa **hiçbiri doldurulmaz**
  (`multiple_forms`). İzin olmayan (NVI dışı) iframe'lere enjeksiyon yapılmaz.

### Yapıştırma ayrıştırma kuralları

- Öncelik: `Etiket: değer` satırları ve sekmeyle ayrılmış başlık + değer satırı (tablodan
  kopyalama) → etiketsiz tahmin. Etiketli değer her zaman tahmine üstün gelir.
- T.C. Kimlik No yalnızca kontrol basamakları tutan 11 haneli sayıdan alınır (telefon numarası
  vb. elenir). Birden fazla geçerli numara veya yıl varsa alan boş bırakılır ve uyarılır.
- Doğum tarihi bulunursa `GG.AA.YYYY` olarak alınır; yalnızca yıl varsa yıl alınır. Takvimde
  olmayan, gelecekteki ve 1900 öncesi tarihler reddedilir. Birden fazla tarih ya da yıl varsa
  alan boş bırakılır.
- "Ad Soyad" tek alandaysa son kelime soyad sayılır; üç ve daha fazla kelimede bu bir tahmindir
  ve işaretlenir. Parantez içi notlar ve rakamlar addan temizlenir.

## Gizlilik, izinler ve veri saklama

- **İzinler:** `storage`, `scripting`, `sidePanel`, `alarms`; host izni yalnızca
  `https://tckimlik.nvi.gov.tr/*`. `tabs` izni, kalıcı içerik betiği, uzak kod veya harici
  bağlantı (`externally_connectable`) yoktur.
- Yapıştırılan ham metin ayrıştırıldıktan hemen sonra panelden silinir; panoya erişim izni
  yoktur (yalnızca görevlinin yapıştırdığı metin işlenir).
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
alan id'leri ve etiketleri canlı sayfanın salt okunur incelemesinden alınmıştır; Angular davranışı
tahminidir. Senaryolar: normal (canlıdaki id'ler, TSPD çerçevesi, çerez bandı), `<label>` ile
bağlı olmayan etiketler, büyük harfli etiketler ve Türkçe `toLowerCase`, önceden dolu alan,
belirsiz alan, geç yüklenen alanlar, hiç gelmeyen alanlar, sanal klavye açık (canlıdaki gibi),
salt okunur alanlar, devre dışı alan, değeri reddeden sayfa, yalnızca id'li alanlar, form yok. **Sentetik örnek veri** düğmesi kontrol basamağı
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
- `test/nvi-url.test.cjs` — adres sınıflandırması; `tckimlik.nvi.gov.tr.example.com` gibi
  benzer görünen adreslerin reddi.
- `test/paste-parser.test.cjs` — etiketli satırlar, tablo satırı, etiketsiz tahmin, telefon gibi
  kontrol basamağı tutmayan sayıların reddi, birden fazla aday olduğunda alanı boş bırakma.
- `test/pack.test.cjs` — paket içeriği, manifest/panel başvurularının pakette olması, zip'in
  bağımsız bir okuyucuyla (Python `zipfile`) doğrulanması, tekrarlanabilirlik.
- `test/filler.browser.test.cjs` — kılavuzdaki düzende altı alanın doldurulması, bağlı olmayan
  etiketler, yalnızca yıl, değer koruma, belirsiz alan, geç yükleme, zaman aşımı, readonly/sanal
  klavye, disabled, reddedilen değer, belge alanlarına, onay kutularına ve Doğrula'ya
  dokunulmaması, sonuçta kişisel veri olmaması, demo sayfası.
- `test/check-dom.test.cjs` — kaydedilmiş form HTML'ini raporlayan aracın testi.
- `test/inspect-live.test.cjs` — canlı inceleme betiğinde tıklama/yazma/gönderme API'si
  bulunmadığının denetimi, adres kısıtı ve betiğin yerel simülasyon üzerinde çalışması.
- `test/extension.e2e.test.cjs` — eklenti gerçek Chromium'a yüklenir; `tckimlik.nvi.gov.tr`
  istekleri yerel simülasyon sayfasına yönlendirilir (gerçek NVI'ye istek gitmez, dış ağ
  istekleri engellenir ve test bunu doğrular). Kapsam: panelden aktarım, panel doğrulaması ve
  hata özeti, NVI dışı sekme / yanlış modül, yüklenirken bekletme, sekme kapanınca ve başka
  adrese gidince silme, iptal, iframe içindeki form, NVI dışı iframe, iki çerçevede form
  (doldurulmaz), geç yüklenen alanlar, yapıştırarak doldurma, etkin sekme göstergesi, **service worker kapatılıp yeniden başlatılınca bekleyen
  doldurmanın tamamlanması**, sanal klavye, zaman aşımı, kapalı sekme, erişilebilirlik temelleri.

Erişilebilirlik: panel (normal ve hata durumu) ve demo, açık ve koyu temada axe-core 4.10
(WCAG 2.1 A/AA + best-practice) ile tarandı; ihlal yok. axe-core depoya eklenmedi; tarama
elle tekrarlanmalı. Ekran okuyucuyla gerçek kullanım testi yapılmadı.

## Canlı ortamda henüz doğrulanmayanlar

Alan yapısı canlıda doğrulandı. **Doldurma da canlıda denendi (18.11.2026):** eklenti yan
panelden gerçek olmayan (sentetik) bilgilerle aktarım yapıldı ve değerler NVI formundaki
alanlara yazıldı (kullanıcı gözlemi; Doğrula'ya basılmadı, sorgu gönderilmedi). Panel sonucu:
T.C. Kimlik No ve Doğum Gün/Ay/Yılı "Dolduruldu"; **Adı ve Soyad "Sayfa değeri kabul etmedi"**.
Yani sayfa ad/soyad değerini yazıldıktan hemen sonra değiştirdi. En olası neden, değerlerin
büyük harfe çevrilmesi. Buna göre eklenti artık:
- yazdıktan sonra sayfanın tepkisi için kısa bir süre (80 ms) bekleyip karar verir,
- değer yalnızca harf büyüklüğü (Türkçe kurallarla) değiştiyse alanı "Dolduruldu (sayfa harfleri
  çevirdi)" sayar,
- silindiyse ya da başka bir değere döndüyse bunu nedeniyle bildirir (`cleared` / `changed`;
  değer gösterilmez).

Düzeltmeden sonra canlıda tekrar denendi (18.11.2026, sentetik veri, Doğrula'ya basılmadan):
panel hatasız, sayfa ad/soyadı **büyük harfe çeviriyor** (gözlendi). Açık kalan noktalar:

1. **Angular'ın değeri kabul etmesi.** Eklenti değeri yazıp `input` ve `change` olaylarını
   tetikliyor. Angular'ın `DefaultValueAccessor`'ı `input` olayını dinler; simülasyonda model
   güncelleniyor ama canlıda gözlenmedi. Değer DOM'da kalmazsa `rejected` bildirilir. Model
   güncellenmezse sayfa Doğrula'da "zorunlu alan" uyarısı verebilir.
2. **Gün/ay biçimi.** `05` yazılıyor (maxlength 2). Sayfanın `5`'i tercih edip etmediği bilinmiyor.
3. **Sanal klavye açıkken davranış.** Alanlar yazılabilir kalıyor, ama klavyenin kendi
   modelinin eklentinin yazdığı değerle çakışıp çakışmadığı gözlenmedi. Panel bu durumda
   "değerleri sayfada kontrol edin" der.
4. **Ad/soyad büyük harf.** Değerler yazıldığı gibi aktarılıyor; sayfa kendisi dönüştürüyor olabilir.

Önerilen deneme: eklentiyi kurun, panelden **gerçek olmayan** (demo sayfasındaki "Sentetik
örnek veri" gibi) bilgilerle bir kez aktarın. Doğrula'ya **basmadan** alanlara yazılan
değerleri ve alanların kırmızı/yeşil (geçerli/geçersiz) durumunu gözle kontrol edin.
Sonra sayfayı yenileyin.

### Canlı sayfayı Playwright ile inceleme (kendi bilgisayarınızda)

NVI'ye erişebilen (Türkiye'deki, yetkili) bir bilgisayarda, Node.js (LTS) kurulu olarak, aşağıdaki
komutları **tek tek** çalıştırın. Windows PowerShell 5.1 `&&` ile birleştirilmiş komutları
kabul etmez.

Windows (PowerShell):

```powershell
cd $HOME
Invoke-WebRequest https://github.com/neklabss/canykr/archive/refs/heads/main.zip -OutFile canykr.zip
Expand-Archive canykr.zip -DestinationPath . -Force
cd canykr-main\nvi-helper
npm install --no-save playwright@1.63.0
npx playwright install chromium
node scripts\inspect-live.cjs --sanal-klavye
Get-Content -Encoding UTF8 nvi-inspect\inspect-report.json
```

macOS / Linux:

```bash
git clone https://github.com/neklabss/canykr
cd canykr/nvi-helper
npm install --no-save playwright@1.63.0
npx playwright install chromium
node scripts/inspect-live.cjs --sanal-klavye
```

PowerShell yönetici olarak açılırsa `C:\WINDOWS\system32` klasöründe başlar ve oraya yazılamaz;
bu yüzden önce `cd $HOME` çalıştırılır. Depo gizliyse ZIP'i tarayıcıdan (GitHub'da oturum açıkken,
**Code → Download ZIP**) indirip `Expand-Archive` adımından devam edin. `npm` "running scripts is
disabled" derse yalnızca o pencere için `Set-ExecutionPolicy -Scope Process Bypass` çalıştırın.

Betik `npm run` yerine doğrudan `node` ile çalıştırılır, çünkü PowerShell 5.1 `--` ile verilen
ek seçenekleri npm'e her zaman iletmez.

Betik (`scripts/inspect-live.cjs`):

- Gerçek bir Chromium penceresinde yalnızca T.C. Kimlik No Doğrulama sayfasını açar ve formun
  JavaScript ile oluşmasını bekler.
- Her çerçevede alanların yapısını (id/name/etiket/readonly/maxlength), düğmeleri, sanal klavye
  öğelerini ve eklentinin hangi alanı hangi input'a eşleyeceğini **salt okunur** raporlar.
- **Hiçbir alana yazmaz, hiçbir öğeye tıklamaz, "Ben robot değilim"e ve Doğrula'ya dokunmaz.**
  Bu, testle denetlenir.
- `--sanal-klavye` ile ilk rapordan sonra durur. "Sanal Klavye Kullan"a **siz** tıklarsınız,
  isterseniz bir alana tıklayıp klavyenin çıktığını görürsünüz (veri girmeyin), Enter'a
  basınca ikinci rapor alınır.
- Çıktılar `nvi-inspect/` klasörüne yazılır (`.gitignore`'da): `inspect-report.json` ve değerleri,
  gizli alanları, görselleri ve betikleri temizlenmiş `nvi-bos-form.html` /
  `nvi-sanal-klavye.html`. Raporda değer yoktur; yalnızca "alan dolu mu" bilgisi vardır.

`inspect-report.json` dosyasını paylaşmanız yeterli. Ona göre `FIELD_RULES`, simülasyon formu ve
"doğrulanmayanlar" listesi güncellenir.

Playwright kuramıyorsanız aynı bilgiyi elle de alabilirsiniz. Sayfayı açın, **hiçbir alana veri
girmeden** geliştirici araçları konsolunda aşağıdakini çalıştırın. Bu komut sayfanın temizlenmiş
bir kopyasını panoya alır:

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

Panodaki içeriği `nvi-bos-form.html` olarak kaydedip şunu çalıştırın:

```bash
npm run check-dom -- nvi-bos-form.html
```

Araç sayfa betiklerini çalıştırmaz ve ağa çıkmaz. Her alanın hangi input'a eşlendiğini yazar;
altı alanın hepsi eşleşirse 0 ile çıkar. Bu dosyalar kişisel veri içermese de depoya
**eklenmemelidir**.

## Otomatik sorgu hakkında

- **reCAPTCHA ("Ben robot değilim") otomatik çözülmez, atlatılmaz.** Sorguyu görevli başlatır.
- NVİ'nin herkese açık `KPSPublic.asmx` doğrulama servisi **30.09.2025'te kapatıldı** (ikincil
  kaynaklar; resmi duyuru bulunamadı). Otomatik ve yasal sorgunun yolu, kurumun **Kimlik Paylaşım
  Sistemi (KPS)** üyeliği (başvuru: `kpsbasvuru.nvi.gov.tr`) ve sunucu tarafında KPS entegrasyonudur.
  KPS erişimi olursa bu eklentiye gerek kalmaz. Koşullar başvurudan önce NVİ'den teyit edilmelidir.

## Henüz yapılmayanlar / kapsam dışı

- **Gerçek müşteri paneli / backend entegrasyonu.** Panel adresi, API sözleşmesi ve kimlik
  doğrulama yöntemi netleşmeden yazılmayacak. Herkese açık veri köprüsü veya kimlik verisi
  içeren URL kullanılmayacak.
- **Sonuç okuma ve panelde otomatik karar.** Önce gerçek yanıt biçimi ve izinli entegrasyon
  yolu doğrulanmalı. Doldurma başarısı hiçbir yerde kimlik doğrulama başarısı olarak kaydedilmez.
