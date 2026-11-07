# Naqisni mobile (version 2.0)

The Naqisni app for iPhone and Android, built with **React Native + Expo** (SDK 58, Expo Router, TypeScript).
It uses the **same Supabase project as naqisni.com**, so every change shows up on the web and the phone at once,
and row-level security decides what each person sees, exactly like the website.

## What's in this first version

| Tab | What it does |
| --- | --- |
| Overview | Reorder now / Running low / On order / Healthy counts, products needing attention, orders waiting for approval, latest alerts |
| Products | Search (name, SKU, barcode), status filters, **barcode scanner**, product page with forecast, supplier and recent stock changes |
| Record | Sale, restock, return or adjustment — same rules as the website's "Record a stock change" |
| Alerts | Open and resolved low-stock alerts, mark as seen |
| Orders | Auto-reorder drafts to approve (quantities can be changed) and orders on the way |
| More | Customer support, phone notifications on/off, store switcher (incl. **All stores**), English / العربية (full right-to-left), light / dark, sign out |
| Support | Same tickets and General chat as naqisni.com's Customer support, live updates |

Stock status uses a copy of the website's `riskLevel` (`src/lib/stock.ts`) so both always agree.

## Run it on your computer (VS Code)

```bash
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator) or scan the QR code.
The barcode scanner and secure sign-in storage need a **development build**, not Expo Go:

```bash
npx expo run:android      # or: npx expo run:ios
# or in the cloud:
npx eas-cli@latest build --profile development --platform android
```

## Settings (`.env`)

```
EXPO_PUBLIC_SUPABASE_URL=...      # naqisni Supabase project
EXPO_PUBLIC_SUPABASE_KEY=...      # publishable key (safe in the app)
EXPO_PUBLIC_WEB_URL=https://naqisni.com
```

Never put the service-role key or the Claude API key in this app — those stay on the server.

## Talking to naqisni.com

Most screens read and write Supabase directly. Actions that need the server (approving orders now,
the Claude-powered AI features later) call the website's API with the person's Supabase token:
`Authorization: Bearer <access_token>` plus `x-naqisni-store`. See `webApi()` in `src/lib/supabase.ts`.

naqisni-web accepts these tokens in `createClient()` (`src/lib/supabase/server.ts`, branch
`mobile-app-support`).

## Phone notifications

- The app saves the phone's Expo push token in `push_tokens` (naqisni-web migration 0064).
- naqisni.com sends new stock alerts to those phones (`src/lib/predict/push.ts`), only for the
  stores each person may use, in the phone's language. Tapping one opens the product.
- They need a real build (not Expo Go on Android) and an EAS project id: run `npx eas-cli@latest init` once.
- Android: add Firebase (FCM) credentials once with `npx eas-cli@latest credentials`.

## Release (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                   # once: links the Expo project
npx eas-cli@latest build --profile preview --platform android    # installable APK to test
npx eas-cli@latest build --profile production --platform android # Play Store (.aab)
npx eas-cli@latest build --profile production --platform ios     # App Store (needs Apple Developer account)
npx eas-cli@latest submit --platform android                      # upload to Play Console
```

## Project layout

```
src/app/            screens (Expo Router)
  (tabs)/           Overview, Products, Alerts, Orders, More
  product/[id].tsx  product page
  order/[id].tsx    order + approval
  record.tsx        record a stock change (sheet)
  scan.tsx          barcode scanner
  stores.tsx        store picker (sheet)
  sign-in.tsx
src/lib/            supabase client, data loaders, stock status, i18n, theme
src/providers/      session, business, store, language and theme
```
