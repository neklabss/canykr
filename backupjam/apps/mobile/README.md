# BackUpJam for iOS & Android (Flutter)

```bash
# from the repo root: regenerate ARB files from the shared catalog (single source of truth)
pnpm i18n:arb
# regenerate design tokens (lib/design/tokens.g.dart)
pnpm --filter @backupjam/design-tokens build

cd apps/mobile
flutter pub get
flutter test            # locale resolution, plurals, RTL, long-string layout, widget tests
flutter run --dart-define=API_URL=http://10.0.2.2:4000   # Android emulator → local API
```

- Bundle / application id: `com.backupjam.app` (placeholder — confirm before store submission).
- Tokens are stored in Keychain / EncryptedSharedPreferences (`flutter_secure_storage`).
- Language: device language automatically; manual override in Settings (persisted locally and
  synced to the account via `PUT /v1/me/preferences`). Arabic renders RTL.
- Not yet verified in this environment: native Android/iOS builds (no Android SDK / Xcode here),
  push notifications (FCM/APNs), Google/Apple sign-in SDK wiring (the API side is implemented).
