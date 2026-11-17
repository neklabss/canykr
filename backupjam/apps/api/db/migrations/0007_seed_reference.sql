-- 0007 · Seed reference data. Deterministic: same rows on every environment.
INSERT INTO locales (tag, direction, status) VALUES
 ('en','ltr','reviewed'), ('tr','ltr','machine_draft'), ('es','ltr','machine_draft'), ('pt-BR','ltr','machine_draft'),
 ('fr','ltr','machine_draft'), ('de','ltr','machine_draft'), ('it','ltr','machine_draft'), ('ar','rtl','machine_draft'),
 ('ru','ltr','machine_draft'), ('uk','ltr','machine_draft'), ('hi','ltr','machine_draft'), ('id','ltr','machine_draft'),
 ('ja','ltr','machine_draft'), ('ko','ltr','machine_draft'), ('zh-Hans','ltr','machine_draft'), ('zh-Hant','ltr','machine_draft');

INSERT INTO currencies (code, exponent) VALUES
 ('USD',2),('EUR',2),('GBP',2),('TRY',2),('BRL',2),('MXN',2),('ARS',2),('COP',2),('CLP',0),('JPY',0),('KRW',0),
 ('CNY',2),('TWD',2),('HKD',2),('INR',2),('IDR',2),('AED',2),('SAR',2),('EGP',2),('UAH',2),('CHF',2),('PLN',2),
 ('SEK',2),('NOK',2),('DKK',2),('CAD',2),('AUD',2),('NZD',2),('SGD',2),('ZAR',2),('KWD',3),('MAD',2);

-- All countries start 'hidden' with payments disabled: software support ≠ legal readiness (docs/20).
INSERT INTO countries (code, default_currency, default_locale, default_time_zone) VALUES
 ('US','USD','en','America/New_York'), ('GB','GBP','en','Europe/London'), ('IE','EUR','en','Europe/Dublin'),
 ('CA','CAD','en','America/Toronto'), ('AU','AUD','en','Australia/Sydney'), ('NZ','NZD','en','Pacific/Auckland'),
 ('TR','TRY','tr','Europe/Istanbul'), ('DE','EUR','de','Europe/Berlin'), ('AT','EUR','de','Europe/Vienna'),
 ('CH','CHF','de','Europe/Zurich'), ('FR','EUR','fr','Europe/Paris'), ('BE','EUR','fr','Europe/Brussels'),
 ('NL','EUR','en','Europe/Amsterdam'), ('IT','EUR','it','Europe/Rome'), ('ES','EUR','es','Europe/Madrid'),
 ('PT','EUR','pt-BR','Europe/Lisbon'), ('PL','PLN','en','Europe/Warsaw'), ('SE','SEK','en','Europe/Stockholm'),
 ('NO','NOK','en','Europe/Oslo'), ('DK','DKK','en','Europe/Copenhagen'), ('UA','UAH','uk','Europe/Kyiv'),
 ('BR','BRL','pt-BR','America/Sao_Paulo'), ('MX','MXN','es','America/Mexico_City'), ('AR','ARS','es','America/Argentina/Buenos_Aires'),
 ('CO','COP','es','America/Bogota'), ('CL','CLP','es','America/Santiago'), ('AE','AED','ar','Asia/Dubai'),
 ('SA','SAR','ar','Asia/Riyadh'), ('EG','EGP','ar','Africa/Cairo'), ('MA','MAD','ar','Africa/Casablanca'),
 ('KW','KWD','ar','Asia/Kuwait'), ('IN','INR','hi','Asia/Kolkata'), ('ID','IDR','id','Asia/Jakarta'),
 ('JP','JPY','ja','Asia/Tokyo'), ('KR','KRW','ko','Asia/Seoul'), ('CN','CNY','zh-Hans','Asia/Shanghai'),
 ('SG','SGD','en','Asia/Singapore'), ('TW','TWD','zh-Hant','Asia/Taipei'), ('HK','HKD','zh-Hant','Asia/Hong_Kong'),
 ('ZA','ZAR','en','Africa/Johannesburg');

INSERT INTO instruments (slug, category, name_key, default_name, sort_order) VALUES
 ('vocals','voice','instrument.vocals','Vocals',10), ('backing_vocals','voice','instrument.backing_vocals','Backing vocals',11),
 ('acoustic_guitar','strings','instrument.acoustic_guitar','Acoustic guitar',20), ('electric_guitar','strings','instrument.electric_guitar','Electric guitar',21),
 ('classical_guitar','strings','instrument.classical_guitar','Classical guitar',22), ('bass_guitar','strings','instrument.bass_guitar','Bass guitar',23),
 ('double_bass','strings','instrument.double_bass','Double bass',24), ('violin','strings','instrument.violin','Violin',25),
 ('viola','strings','instrument.viola','Viola',26), ('cello','strings','instrument.cello','Cello',27), ('harp','strings','instrument.harp','Harp',28),
 ('oud','strings','instrument.oud','Oud',29), ('baglama','strings','instrument.baglama','Bağlama / Saz',30), ('sitar','strings','instrument.sitar','Sitar',31),
 ('ukulele','strings','instrument.ukulele','Ukulele',32), ('banjo','strings','instrument.banjo','Banjo',33), ('mandolin','strings','instrument.mandolin','Mandolin',34),
 ('piano','keys','instrument.piano','Piano',40), ('keyboards','keys','instrument.keyboards','Keyboards / synth',41), ('organ','keys','instrument.organ','Organ',42),
 ('accordion','keys','instrument.accordion','Accordion',43), ('drums','percussion','instrument.drums','Drum kit',50),
 ('percussion','percussion','instrument.percussion','Percussion',51), ('darbuka','percussion','instrument.darbuka','Darbuka',52),
 ('cajon','percussion','instrument.cajon','Cajón',53), ('tabla','percussion','instrument.tabla','Tabla',54),
 ('saxophone','wind','instrument.saxophone','Saxophone',60), ('flute','wind','instrument.flute','Flute',61), ('clarinet','wind','instrument.clarinet','Clarinet',62),
 ('ney','wind','instrument.ney','Ney',63), ('harmonica','wind','instrument.harmonica','Harmonica',64),
 ('trumpet','brass','instrument.trumpet','Trumpet',70), ('trombone','brass','instrument.trombone','Trombone',71),
 ('dj','electronic','instrument.dj','DJ',80), ('producer','electronic','instrument.producer','Producer / electronics',81),
 ('sound_engineer','tech','instrument.sound_engineer','Sound engineering',90), ('lighting','tech','instrument.lighting','Lighting',91);

INSERT INTO genres (slug, name_key, default_name, sort_order) VALUES
 ('rock','genre.rock','Rock',10), ('pop','genre.pop','Pop',11), ('jazz','genre.jazz','Jazz',12), ('blues','genre.blues','Blues',13),
 ('funk','genre.funk','Funk',14), ('soul','genre.soul','Soul / R&B',15), ('hip_hop','genre.hip_hop','Hip-hop',16),
 ('electronic','genre.electronic','Electronic',17), ('house','genre.house','House',18), ('techno','genre.techno','Techno',19),
 ('metal','genre.metal','Metal',20), ('punk','genre.punk','Punk',21), ('indie','genre.indie','Indie',22), ('folk','genre.folk','Folk',23),
 ('country','genre.country','Country',24), ('classical','genre.classical','Classical',25), ('latin','genre.latin','Latin',26),
 ('reggae','genre.reggae','Reggae',27), ('world','genre.world','World',28), ('turkish_folk','genre.turkish_folk','Turkish folk',29),
 ('turkish_classical','genre.turkish_classical','Turkish classical',30), ('arabesque','genre.arabesque','Arabesque',31),
 ('kpop','genre.kpop','K-pop',32), ('jpop','genre.jpop','J-pop',33), ('bollywood','genre.bollywood','Bollywood',34),
 ('mpb','genre.mpb','MPB',35), ('samba','genre.samba','Samba',36), ('flamenco','genre.flamenco','Flamenco',37),
 ('gospel','genre.gospel','Gospel',38), ('wedding','genre.wedding','Wedding & events',39), ('cover','genre.cover','Covers',40);

INSERT INTO feature_flags (key, description, enabled) VALUES
 ('auth.google', 'Google sign-in', true),
 ('auth.apple', 'Sign in with Apple', true),
 ('auth.phone_verification', 'Optional phone verification (needs SMS provider)', false),
 ('i18n.ugc_ai_translation', 'AI translation of user-generated content (with disclosure)', false),
 ('marketplace.jobs', 'Job marketplace (Phase 2)', false),
 ('marketplace.emergency_requests', 'Emergency musician requests (Phase 3)', false),
 ('payments.bookings', 'Paid bookings via licensed provider (Phase 4)', false),
 ('community.events', 'Community events (Phase 5)', false),
 ('growth.challenges', 'Challenges (Phase 6)', false);
