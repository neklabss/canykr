# 06 — Design System ("Jam" system)

Status: Draft v0.1 · Phase 1 (Foundation) deliverable per 01-prd §6; components for later features (price chip P2, emergency card P3, verification badge P4, sponsored label P6) are specified now and built in their feature's phase · Implemented as tokens in Flutter (Material 3 + custom tokens, D16) and web/admin (CSS variables). Token names here are canonical; code mirrors them (`color.bg.canvas` → Dart `JamColors.bgCanvas`, CSS `--color-bg-canvas`).

This is an original system. It must not imitate the visual identity of Spotify, Instagram, LinkedIn, SoundCloud, Bandcamp or any other product (no green-on-black circle play buttons, no gradient-ring avatars, no blue "professional" chrome).

---

## 1. Brand principles

| Principle | Means | Doesn't mean |
|---|---|---|
| **Stage-ready** | Deep dark canvas, high contrast, one electric accent — readable in a dim venue or backstage | Neon everywhere, glow effects |
| **Trust is shown, not sold** | Badges have explainers; sponsored is always labelled; prices state currency | Gold "premium verified" ticks |
| **Fast under pressure** | Emergency flows ≤ 4 steps, large targets, short copy | Hiding info behind gestures |
| **Global by default** | Every component tolerates RTL, +40 % strings, CJK/Devanagari/Arabic scripts | Fixed-width labels, icon-only meaning |
| **Quiet craft** | Restrained motion, generous spacing, typographic hierarchy | Skeuomorphic instruments, stock-photo heroes |

## 2. Color

### 2.1 Accent: "Jam Volt"

An electric lime-yellow, `#C6FF3D`, chosen to read on a near-black stage background and to be distinct from common music-app greens and social-app blues/pinks.

- On **dark** themes Jam Volt is used as fill, text, icon and focus ring.
- On **light** themes Jam Volt is used **only as a fill** (with dark text on it). Text, icons, links and focus rings use the darker **Volt Ink** `#3D6B00` because Jam Volt on white is ~1.1:1.

### 2.2 Dark theme (default on mobile)

| Token | Hex | Use |
|---|---|---|
| `color.bg.canvas` | `#0B0D12` | App/page background |
| `color.bg.surface` | `#14171F` | Cards, sheets, nav bars |
| `color.bg.raised` | `#1C2029` | Popovers, menus, inputs |
| `color.bg.sunken` | `#07080C` | Wells, code, media letterbox |
| `color.bg.accentSubtle` | `#26331A` | Selected chip, highlight row |
| `color.border.subtle` | `#2A2F3A` | Dividers (decorative only) |
| `color.border.strong` | `#7D8598` | Input borders, outlines (≥ 3:1) |
| `color.text.primary` | `#F4F6FA` | Body, headings |
| `color.text.secondary` | `#A3ABBD` | Meta, captions |
| `color.text.tertiary` | `#7D8598` | Placeholder, disabled-adjacent hints |
| `color.text.onAccent` | `#0B0D12` | Text on Jam Volt fill |
| `color.accent.primary` | `#C6FF3D` | Primary buttons, active tab, links, focus |
| `color.accent.hover` | `#D4FF6B` | Hover |
| `color.accent.pressed` | `#A8E01F` | Pressed |
| `color.accent.text` | `#C6FF3D` | Accent text/icon |
| `color.focus.ring` | `#C6FF3D` | 2 px ring + 2 px canvas gap |
| `color.status.success` | `#3DDC97` | Confirmed, filled |
| `color.status.warning` | `#FFB547` | Expiring, pending |
| `color.status.danger` | `#FF5C5C` | Errors, cancel, emergency marker |
| `color.status.info` | `#4FD1FF` | Info, offline bar |
| `color.badge.verified` | `#4FD1FF` | Verification badge glyph |
| `color.label.sponsored.fg` | `#A3ABBD` | Sponsored label text |
| `color.label.sponsored.bg` | `#1C2029` | Sponsored label background |
| `color.overlay.scrim` | `#000000` @ 60 % | Modal scrim |

### 2.3 Light theme (default on web public pages)

| Token | Hex | Use |
|---|---|---|
| `color.bg.canvas` | `#F7F8FA` | Page background |
| `color.bg.surface` | `#FFFFFF` | Cards, sheets |
| `color.bg.raised` | `#FFFFFF` (+ elevation) | Popovers |
| `color.bg.sunken` | `#ECEEF2` | Wells, sponsored label bg |
| `color.bg.accentSubtle` | `#E6F9C2` | Selected chip, highlight row |
| `color.border.subtle` | `#D7DBE3` | Dividers (decorative only) |
| `color.border.strong` | `#5F6778` | Input borders (≥ 3:1) |
| `color.text.primary` | `#11141B` | Body, headings |
| `color.text.secondary` | `#4A5263` | Meta |
| `color.text.tertiary` | `#5F6778` | Placeholder |
| `color.text.onAccent` | `#11141B` | Text on Jam Volt fill |
| `color.accent.primary` | `#C6FF3D` | Primary button **fill** only |
| `color.accent.hover` | `#B3EB2A` | Hover fill |
| `color.accent.pressed` | `#A8E01F` | Pressed fill |
| `color.accent.border` | `#4E7A00` | 1 px border around Volt fills (gives ≥ 3:1 boundary) |
| `color.accent.text` | `#3D6B00` | Links, accent icons, active tab label ("Volt Ink") |
| `color.focus.ring` | `#3D6B00` | 2 px ring + 2 px gap |
| `color.status.success` | `#1B7A4B` | — |
| `color.status.warning` | `#8A5300` | — |
| `color.status.danger` | `#C62828` | — |
| `color.status.info` | `#006C9C` | — |
| `color.badge.verified` | `#006C9C` | — |
| `color.label.sponsored.fg` | `#4A5263` | — |
| `color.label.sponsored.bg` | `#ECEEF2` | — |
| `color.overlay.scrim` | `#11141B` @ 50 % | — |

### 2.4 Contrast verification (WCAG 2.2)

Ratios computed with the WCAG relative-luminance formula. AA: text ≥ 4.5:1 (large ≥ 3:1), non-text UI ≥ 3:1.

| Theme | Foreground | Background | Ratio | Result |
|---|---|---|---|---|
| Dark | text.primary `#F4F6FA` | canvas `#0B0D12` | 17.96 | AAA |
| Dark | text.primary `#F4F6FA` | surface `#14171F` | 16.56 | AAA |
| Dark | text.secondary `#A3ABBD` | canvas | 8.44 | AAA |
| Dark | text.secondary | raised `#1C2029` | 7.08 | AAA |
| Dark | text.tertiary `#7D8598` | canvas | 5.26 | AA |
| Dark | text.tertiary | raised | 4.41 | AA large only — do not use for body on raised |
| Dark | accent `#C6FF3D` | canvas | 16.45 | AAA |
| Dark | accent | surface | 15.16 | AAA |
| Dark | onAccent `#0B0D12` | accent | 16.45 | AAA |
| Dark | onAccent | accent.pressed `#A8E01F` | 12.35 | AAA |
| Dark | accent | accentSubtle `#26331A` | 11.31 | AAA |
| Dark | border.strong `#7D8598` | surface | 4.85 | ≥ 3:1 ✓ |
| Dark | danger `#FF5C5C` | surface | 5.92 | AA |
| Dark | warning `#FFB547` | surface | 10.20 | AAA |
| Dark | success `#3DDC97` | surface | 10.14 | AAA |
| Dark | info/verified `#4FD1FF` | surface | 10.15 | AAA |
| Light | text.primary `#11141B` | canvas `#F7F8FA` | 17.34 | AAA |
| Light | text.primary | surface `#FFFFFF` | 18.43 | AAA |
| Light | text.secondary `#4A5263` | canvas | 7.38 | AAA |
| Light | text.secondary | sunken `#ECEEF2` | 6.75 | AA |
| Light | text.tertiary `#5F6778` | canvas | 5.34 | AA |
| Light | onAccent `#11141B` | accent `#C6FF3D` | 15.59 | AAA |
| Light | onAccent | accent.hover `#B3EB2A` | 13.02 | AAA |
| Light | accent.text `#3D6B00` | canvas | 5.99 | AA |
| Light | accent.text | surface | 6.36 | AA |
| Light | accent.text | accentSubtle `#E6F9C2` | 5.66 | AA |
| Light | accent.border `#4E7A00` | canvas | 4.81 | ≥ 3:1 ✓ |
| Light | border.strong `#5F6778` | canvas | 5.34 | ≥ 3:1 ✓ |
| Light | danger `#C62828` | canvas | 5.29 | AA |
| Light | warning `#8A5300` | surface | 6.33 | AA |
| Light | success `#1B7A4B` | surface | 5.34 | AA |
| Light | info/verified `#006C9C` | surface | 5.79 | AA |

Rules
- **Never** place Jam Volt text/icons on light backgrounds; use `color.accent.text`.
- `color.border.subtle` is decorative (< 3:1) and must not be the only boundary of an interactive control.
- Status is never conveyed by color alone: always icon + text.
- CI runs a token contrast check; adding a pair below threshold fails the build.

## 3. Typography

### 3.1 Families

| Token | Stack | Coverage |
|---|---|---|
| `font.family.sans` | `Inter`, then script fallbacks below, then `system-ui` | Latin, Latin-Ext (tr, de, fr, es, pt, it, id), Cyrillic (ru, uk), Greek |
| fallback `ar` | `Noto Sans Arabic` | Arabic |
| fallback `hi` | `Noto Sans Devanagari` | Hindi |
| fallback `ja` | `Noto Sans JP` | Japanese |
| fallback `ko` | `Noto Sans KR` | Korean |
| fallback `zh-Hans` | `Noto Sans SC` | Simplified Chinese |
| fallback `zh-Hant` | `Noto Sans TC` | Traditional Chinese |
| `font.family.mono` | `JetBrains Mono`, `Noto Sans Mono`, monospace | IDs, amounts in admin tables |

Loading: web uses `font-display: swap`, subsets per locale (load only the script needed for current `locale`; CJK served as unicode-range slices). Mobile bundles Inter + Noto Arabic + Noto Devanagari; CJK fonts downloaded on first use of that locale (system CJK font used until ready).

Per-locale font ordering puts the locale's script first for Han unification (e.g. `ja` → Noto Sans JP before SC/TC) so shared ideographs render with correct regional glyphs.

### 3.2 Scale

Sizes in logical px (Flutter dp / CSS px at 1×). Line heights for Latin; scripts get adjustments in §3.3.

| Token | Size | Line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `type.display.lg` | 40 | 48 | 700 | −0.5 | Web hero only |
| `type.display.md` | 32 | 40 | 700 | −0.25 | Page titles (web) |
| `type.heading.lg` | 24 | 32 | 650 | 0 | Screen titles |
| `type.heading.md` | 20 | 28 | 650 | 0 | Section titles |
| `type.heading.sm` | 17 | 24 | 600 | 0 | Card titles |
| `type.body.lg` | 17 | 26 | 400 | 0 | Primary body (mobile) |
| `type.body.md` | 15 | 22 | 400 | 0 | Default body |
| `type.body.sm` | 13 | 18 | 400 | 0.1 | Meta |
| `type.label.lg` | 16 | 20 | 600 | 0 | Buttons |
| `type.label.md` | 14 | 18 | 600 | 0.1 | Chips, tabs |
| `type.label.sm` | 12 | 16 | 600 | 0.2 | Badges, sponsored label |
| `type.numeric.price` | 17 | 22 | 650 | 0 | Prices (tabular figures `tnum`) |

### 3.3 Script adjustments

| Script | Rule |
|---|---|
| Arabic | Line height ×1.15; tracking always 0; no uppercase transforms; weight max 700 |
| Devanagari | Line height ×1.2 (head-line + matras); min size 13 → 14 |
| CJK | Line height ×1.1; tracking 0; no italics (use weight); avoid breaking within words for `ko` (`word-break: keep-all`) |
| All | Never `text-transform: uppercase` on translated strings (breaks Turkish İ/ı, German ß) — use label tokens with case as written in source |

Dynamic type: support OS text scaling to 200 %; layouts reflow, no truncation of primary actions.

## 4. Spacing

4-pt base.

| Token | Value |
|---|---|
| `space.0` | 0 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.5` | 20 |
| `space.6` | 24 |
| `space.8` | 32 |
| `space.10` | 40 |
| `space.12` | 48 |
| `space.16` | 64 |

Layout: mobile gutter `space.4`; web content max width 1200, gutter `space.4` (< 600 px), `space.6` (≥ 600), `space.8` (≥ 1024). Grid 4 / 8 / 12 columns.

## 5. Radius

| Token | Value | Use |
|---|---|---|
| `radius.xs` | 4 | Badges, sponsored label |
| `radius.sm` | 8 | Inputs, chips |
| `radius.md` | 12 | Buttons, cards |
| `radius.lg` | 20 | Sheets, modals |
| `radius.full` | 9999 | Avatars, pills |

Cards use `radius.md` with a distinctive **notched corner**: the top-end corner (top-right LTR, top-left RTL) uses `radius.xs` — a small brand signature ("the jack cut").

## 6. Elevation

Dark themes rely on surface color steps, not shadows. Light themes use shadows.

| Token | Dark | Light |
|---|---|---|
| `elevation.0` | `bg.canvas`, no shadow | no shadow |
| `elevation.1` | `bg.surface` | `0 1 2 rgba(17,20,27,0.06), 0 1 1 rgba(17,20,27,0.04)` |
| `elevation.2` | `bg.raised` + 1 px `border.subtle` | `0 4 12 rgba(17,20,27,0.08)` |
| `elevation.3` | `bg.raised` + scrim behind | `0 12 32 rgba(17,20,27,0.14)` |

## 7. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion.duration.instant` | 80 ms | linear | Press feedback |
| `motion.duration.fast` | 150 ms | `cubic-bezier(0.2,0,0,1)` | Hover, chip toggle |
| `motion.duration.base` | 220 ms | `cubic-bezier(0.2,0,0,1)` | Sheets, tab switch |
| `motion.duration.slow` | 320 ms | `cubic-bezier(0.3,0,0,1)` | Page transitions |

Rules: transform/opacity only; no parallax; no autoplaying animated backgrounds. Emergency alert uses a single 2-beat pulse on the marker (not looping). `prefers-reduced-motion` / Flutter `MediaQuery.disableAnimations` → all durations 0 except opacity fades ≤ 100 ms; pulse replaced by static marker.

## 8. Iconography

- 24 px grid, 1.75 px stroke, rounded joins, outline default, filled for active state.
- Custom glyphs: `emergency` (lightning-in-circle), `offer` (two arrows), `snapshot` (lock-document), `position` (seat), `backline` (amp).
- Icons mirrored in RTL only if directional (arrows, back, send, reply, list indent). Not mirrored: play/pause, clock, checkmark, media, logos, search.
- Every icon-only button has an accessible label; icon + text preferred for primary nav.

## 9. Components

Each component ships light/dark, LTR/RTL, and all states: default, hover (web), pressed, focused, disabled, loading.

### 9.1 Buttons

| Variant | Dark | Light | Height |
|---|---|---|---|
| `button.primary` | Fill `accent.primary`, text `text.onAccent` | Fill `accent.primary`, border 1 px `accent.border`, text `text.onAccent` | 48 (mobile) / 44 (web) |
| `button.secondary` | Transparent, 1 px `border.strong`, text `text.primary` | Same with light tokens | 48 / 44 |
| `button.ghost` | Text `accent.text` | Text `accent.text` | 48 / 44 |
| `button.danger` | Fill `status.danger`, text `#0B0D12` | Fill `status.danger`, text `#FFFFFF` (5.62:1) | 48 / 44 |
| `button.emergency` | Primary + `emergency` icon, full width | Same | 56 |

Min width 88; label never truncated — wraps to 2 lines, then button grows. Loading replaces label with spinner and keeps width.

### 9.2 Cards

- `card.base`: `bg.surface`, `radius.md` with jack-cut, padding `space.4`.
- **`card.performer`**: avatar (56, `radius.full`), name (`heading.sm`, max 2 lines), capability/instrument line (`body.sm`, 1 line + "+N"), location distance, rating "4.8 (23)" — only from completed bookings, badges row, **price chip**, optional availability dot ("Available tonight"). Sponsored version adds sponsored label at top-start; nothing else changes (no larger size, no accent border).
- `card.job`: title, fee, date/time (viewer TZ + venue TZ if different), distance, poster badges; emergency variant has `status.danger` left (start) rule 4 px and `emergency` icon + "Emergency · tonight" text.
- `card.event`: date block (locale-formatted), title, venue, positions progress "3/5 filled" for organizers.

### 9.3 Price chip

- Format: `from {amount}` via ICU, e.g. en "from €250", tr "250 €'dan başlayan", de "ab 250 €", ar "ابتداءً من ٢٥٠ €" or Western digits per setting.
- If converted: "≈ €85" with original in secondary text "3,000 TRY" (stacked or inline depending on width).
- Unit suffix: "/gig", "/hour".
- `type.numeric.price`, tabular figures; amounts are never truncated (chip grows).

### 9.4 Verification badge

- Glyph: shield-with-note outline, `color.badge.verified`; distinct glyph per type is not used — label text differentiates.
- Label text (`label.sm`): "Identity verified", "Official band", "Official artist", "Verified venue", "Verified organizer" (tokens `identity_verified` etc.).
- Tap/hover opens **badge explainer** (sheet M-DISC-11 / popover): what was checked, what it does **not** guarantee, date verified, link to W-PUB-06.
- Never gold, never combined with premium indicators, never animated.

### 9.5 Sponsored label

- Pill `radius.xs`, `label.sm`, `label.sponsored.fg` on `label.sponsored.bg`, text "Sponsored" (localised), placed top-start of the item; info icon opens "Why am I seeing this?".
- Minimum contrast AA (dark 7.08:1, light 6.75:1). Must be visible without interaction; must not be smaller than `label.sm` or hidden by truncation.

### 9.6 Inputs

- Height 48; `bg.raised` (dark) / `bg.surface` (light); 1 px `border.strong`; focus ring `focus.ring`; error border `status.danger` + icon + message below.
- Label always visible above (no placeholder-as-label).
- Money input: currency selector at start (end in RTL is **not** used — follows reading start), numeric keyboard, stores minor units.
- Handles/URLs/emails: forced `dir=ltr` inside RTL layouts.

### 9.7 Tabs, nav, chips

- Bottom nav: 5 items, icon + label always; active = filled icon + `accent.text` label + 3 px indicator; label max 1 line, shrinks to `label.sm` then ellipsis only as last resort (labels kept short in all locales: "Keşfet", "Entdecken", "اكتشف").
- Segmented tabs: scrollable when overflowing; never shrink below 44 height.
- Filter chips: `radius.sm`, selected `bg.accentSubtle` + check icon.

### 9.8 States

| Component | Content |
|---|---|
| `state.loading` | Skeleton blocks in `bg.raised`/`bg.sunken`, shimmer disabled under reduced motion |
| `state.empty` | Title, one sentence, one primary action; no illustrations required |
| `state.error` | Title, cause in plain words, Retry button, small error code |
| `state.offline` | Top bar `status.info` icon + "You're offline — showing saved data"; disabled actions explain why |
| `state.permissionDenied` | Lock icon, "You need {permission label} in {org}", who can grant it, link to request |
| `state.unverified` | Banner: "Verify your email to apply or send offers" + Resend |
| `banner.testPayments` | Full-width `status.warning` bar: "TEST PAYMENTS — no real money" (MockPaymentProvider) |

## 10. Touch targets & accessibility

- Minimum touch target 48×48 dp on Android/Flutter, 44×44 pt on iOS & web; spacing ≥ 8 between targets.
- Focus order follows reading order (mirrored in RTL); visible focus ring everywhere.
- Screen reader labels for badges include the explainer summary; prices read with currency name.
- Support 200 % text scale, high-contrast OS modes, color-blind safe status (icon + text).

## 11. RTL mirroring rules

| Element | Mirror? |
|---|---|
| Layout direction, padding/margins (use `start`/`end` only, never `left`/`right`) | Yes |
| Back/forward arrows, chevrons, send icon | Yes |
| Bottom-nav order | Yes |
| Progress steppers, carousels swipe direction | Yes |
| Card jack-cut corner (top-end) | Yes |
| Emergency card accent rule (start edge) | Yes |
| Media controls, scrubbers, waveforms | No |
| Clocks, timelines of time-of-day, charts' x-axis | No |
| Numbers, phone numbers, handles, URLs | No (bidi-isolated LTR) |
| Logos, brand marks | No |
| Checkmarks, play icon | No |

Implementation: Flutter `Directionality` + `EdgeInsetsDirectional`; web logical CSS properties (`margin-inline-start`) and `dir` on `<html>`. Lint rule bans physical `left/right` in component code.

## 12. Long-string tolerance

| Rule | Detail |
|---|---|
| Expansion budget | Design for +40 % over English (German, Russian, Portuguese, Turkish often +30–40 %); short labels (< 10 chars) up to +100 % |
| Pseudo-locale | `en-XA` (accented, +40 %) and `ar-XB` (RTL) builds used in screenshot tests |
| Wrapping | Buttons wrap to 2 lines; card titles 2 lines then ellipsis with full text in accessibility label and tooltip |
| No fixed widths | Chips, tabs, badges size to content |
| Compound words | Enable hyphenation for `de` (`hyphens: auto`, Flutter soft-hyphen dictionary) |
| Numbers/dates | Always ICU formatted; never concatenated strings |
| Truncation | Never truncate prices, dates, legal text, badge labels, sponsored label |

## 13. Token JSON (canonical values)

```json
{
  "color": {
    "dark": {
      "bg": { "canvas": "#0B0D12", "surface": "#14171F", "raised": "#1C2029", "sunken": "#07080C", "accentSubtle": "#26331A" },
      "border": { "subtle": "#2A2F3A", "strong": "#7D8598" },
      "text": { "primary": "#F4F6FA", "secondary": "#A3ABBD", "tertiary": "#7D8598", "onAccent": "#0B0D12" },
      "accent": { "primary": "#C6FF3D", "hover": "#D4FF6B", "pressed": "#A8E01F", "text": "#C6FF3D", "border": "#C6FF3D" },
      "focus": { "ring": "#C6FF3D" },
      "status": { "success": "#3DDC97", "warning": "#FFB547", "danger": "#FF5C5C", "info": "#4FD1FF" },
      "badge": { "verified": "#4FD1FF" },
      "label": { "sponsored": { "fg": "#A3ABBD", "bg": "#1C2029" } },
      "overlay": { "scrim": "rgba(0,0,0,0.60)" }
    },
    "light": {
      "bg": { "canvas": "#F7F8FA", "surface": "#FFFFFF", "raised": "#FFFFFF", "sunken": "#ECEEF2", "accentSubtle": "#E6F9C2" },
      "border": { "subtle": "#D7DBE3", "strong": "#5F6778" },
      "text": { "primary": "#11141B", "secondary": "#4A5263", "tertiary": "#5F6778", "onAccent": "#11141B" },
      "accent": { "primary": "#C6FF3D", "hover": "#B3EB2A", "pressed": "#A8E01F", "text": "#3D6B00", "border": "#4E7A00" },
      "focus": { "ring": "#3D6B00" },
      "status": { "success": "#1B7A4B", "warning": "#8A5300", "danger": "#C62828", "info": "#006C9C" },
      "badge": { "verified": "#006C9C" },
      "label": { "sponsored": { "fg": "#4A5263", "bg": "#ECEEF2" } },
      "overlay": { "scrim": "rgba(17,20,27,0.50)" }
    }
  },
  "font": {
    "family": {
      "sans": ["Inter", "Noto Sans Arabic", "Noto Sans Devanagari", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", "system-ui", "sans-serif"],
      "mono": ["JetBrains Mono", "Noto Sans Mono", "monospace"]
    },
    "scriptLineHeightMultiplier": { "arab": 1.15, "deva": 1.2, "cjk": 1.1, "latn": 1.0, "cyrl": 1.0 }
  },
  "type": {
    "display": { "lg": { "size": 40, "lineHeight": 48, "weight": 700, "tracking": -0.5 }, "md": { "size": 32, "lineHeight": 40, "weight": 700, "tracking": -0.25 } },
    "heading": { "lg": { "size": 24, "lineHeight": 32, "weight": 650 }, "md": { "size": 20, "lineHeight": 28, "weight": 650 }, "sm": { "size": 17, "lineHeight": 24, "weight": 600 } },
    "body": { "lg": { "size": 17, "lineHeight": 26, "weight": 400 }, "md": { "size": 15, "lineHeight": 22, "weight": 400 }, "sm": { "size": 13, "lineHeight": 18, "weight": 400, "tracking": 0.1 } },
    "label": { "lg": { "size": 16, "lineHeight": 20, "weight": 600 }, "md": { "size": 14, "lineHeight": 18, "weight": 600, "tracking": 0.1 }, "sm": { "size": 12, "lineHeight": 16, "weight": 600, "tracking": 0.2 } },
    "numeric": { "price": { "size": 17, "lineHeight": 22, "weight": 650, "features": ["tnum"] } }
  },
  "space": { "0": 0, "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48, "16": 64 },
  "radius": { "xs": 4, "sm": 8, "md": 12, "lg": 20, "full": 9999 },
  "elevation": {
    "light": {
      "1": "0 1px 2px rgba(17,20,27,0.06), 0 1px 1px rgba(17,20,27,0.04)",
      "2": "0 4px 12px rgba(17,20,27,0.08)",
      "3": "0 12px 32px rgba(17,20,27,0.14)"
    }
  },
  "motion": {
    "duration": { "instant": 80, "fast": 150, "base": 220, "slow": 320 },
    "easing": { "standard": "cubic-bezier(0.2,0,0,1)", "emphasized": "cubic-bezier(0.3,0,0,1)" },
    "reducedMotion": { "maxFadeMs": 100 }
  },
  "size": {
    "touchTarget": { "android": 48, "ios": 44, "web": 44 },
    "button": { "heightMobile": 48, "heightWeb": 44, "heightEmergency": 56, "minWidth": 88 },
    "input": { "height": 48 },
    "icon": { "md": 24, "strokeWidth": 1.75 },
    "avatar": { "card": 56 }
  },
  "i18n": { "stringExpansionBudget": 0.4, "shortLabelExpansionBudget": 1.0 }
}
```
