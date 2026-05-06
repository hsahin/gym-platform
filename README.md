# ClaimTech Gym Platform

Single-app sportschoolplatform op Next.js 15, gebouwd bovenop remote `@claimtech/*`
packages uit GitHub Packages. Er worden bewust geen workspaces gebruikt in deze
repo.

## Remote ClaimTech baseline

Deze app resolveert en gebruikt de volgende remote packages:

- `@claimtech/auth@0.2.3`
- `@claimtech/cache@0.2.3`
- `@claimtech/core@0.2.3`
- `@claimtech/database@0.2.3`
- `@claimtech/feature-flags@0.2.3`
- `@claimtech/i18n@0.2.4`
- `@claimtech/messaging@0.2.3`
- `@claimtech/ops@0.2.4`
- `@claimtech/permissions@0.2.3`
- `@claimtech/storage@0.2.3`
- `@claimtech/tenant@0.2.3`
- `@claimtech/users@0.2.3`

## Package ownership map

- `@claimtech/auth`, `@claimtech/tenant`: lokale sessies, actor context en tenant-binding
- `@claimtech/permissions`, `@claimtech/users`: rollen, grants en staff directory
- `@claimtech/database`: optionele Mongo adapter voor de gym stores
- `@claimtech/cache`: tenant-aware dashboard cache op Redis
- `@claimtech/feature-flags`: waitlist, self check-in, waivers en analytics rollouts
- `@claimtech/messaging`: booking confirmation preview en optionele WhatsApp providers
- `@claimtech/storage`: tenant-aware waiver paths en Spaces readiness
- `@claimtech/ops`: audit log, health checks en rate limiting
- `@claimtech/i18n`: currency en phone formatting

## Sportschool domeinlaag

De app-specifieke code zit in:

- `src/server/types.ts`
- `src/server/persistence/*`
- `src/server/runtime/gym-services.ts`
- `src/app/api/platform/*`
- `src/components/*`

Hierin staan de sportschool-entiteiten die niet in de baseline packages zitten:

- vestigingen
- membership plans
- leden
- trainers
- lessen
- boekingen
- aanwezigheid
- waivers

## Lokaal draaien

1. Zorg dat `GITHUB_TOKEN` gezet is zodat `@claimtech/*` van GitHub Packages resolveert.
2. Kopieer `.env.example` naar `.env.local` en vul daar je live variabelen in als je Mongo, Redis, WhatsApp of Spaces wilt activeren. Next.js laadt `.env.example` zelf niet in.
3. Start de app:

```bash
npm install
npm run dev
```

Open daarna [http://localhost:3000](http://localhost:3000).

Bij de eerste start richt je het platform eenmalig in met:

- naam van de sportschool
- naam van de eigenaar
- e-mailadres van de eigenaar
- wachtwoord

De publieke setup-route is daarna gesloten. Nieuwe eigenaars maak je aan via
superadmin/beheer, niet via `/login?mode=signup`.

Daarna log je in met echte teamaccounts en beheer je de gym vanuit aparte
dashboardpagina's zoals `/dashboard/members`, `/dashboard/contracts`,
`/dashboard/payments`, `/dashboard/smartdoors`, `/dashboard/locations` en
`/dashboard/staff`.

## Native leden-app

De iOS- en Android-apps staan in `ios/` en `android/` en gebruiken Capacitor.
Deze app is gericht op leden en start met de lokale packaged shell in
`mobile-shell/`, niet met een remote `server.url`. Daardoor voelt de app als
een eigen mobiele start en opent de live ledenportal pas wanneer een lid een
live actie uitvoert, zoals rooster openen, inloggen of ledenservice regelen.

De live ledenportal waar de shell mee synchroniseert komt uit
`GYMOS_MOBILE_APP_ORIGIN` en wordt tijdens `npm run mobile:sync` naar
`mobile-shell/mobile-config.js`, Capacitor en de native projecten geschreven:

```bash
GYMOS_MOBILE_APP_ORIGIN=https://jouw-gymos-domein.example
```

Handige commands:

```bash
npm run mobile:assets
npm run mobile:config
npm run mobile:sync
npm run mobile:ios
npm run mobile:android
```

`npm run mobile:assets` genereert de GymOS app-iconen en splashscreens voor
iOS en Android opnieuw. `npm run mobile:sync` draait eerst `mobile:config` en
`mobile:assets` voordat Capacitor de native projecten bijwerkt.

Leden kunnen via deze app:

- lessen en vrije gymblokken bekijken en reserveren
- eigen reserveringen bekijken en annuleren
- contractdocumenten en betalingsbewijzen openen
- betaalmethode-updates aanvragen
- pauzeverzoeken indienen
- pushmeldingen en lokale reminders inschakelen
- een QR-check-in pas tonen
- een les aan de eigen agenda toevoegen
- de sessie ontgrendelen met Face ID, Touch ID of biometrie op Android
- offline de laatst geopende ledeninformatie zien
- wisselen tussen gekoppelde clubs wanneer hetzelfde ledenaccount bij meerdere
  gyms actief is

Voor productie moeten de native app-koppelingen met echte store-gegevens worden
gevuld. De `/.well-known` routes geven bewust `503` terug zolang deze waarden
ontbreken, zodat deep links niet stil met placeholder-data online komen:

- `APPLE_TEAM_ID` voor `/.well-known/apple-app-site-association`
- `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` voor `/.well-known/assetlinks.json`
- APNs/Firebase projectinstellingen voor pushmeldingen op afstand
- Apple Wallet en Google Wallet issuer-gegevens voordat GymOS echte walletpassen
  kan uitgeven

Mollie-checkouts horen niet in de Capacitor WebView. De native app laat alleen
GymOS zelf in `allowNavigation`; betaalpagina's openen via de native browser
zodat 3DS, bankapps en terugkeer naar `/join?payment=return` via app links
betrouwbaar blijven werken.

## Productie-eisen

De app draait bewust niet op local state, browser localStorage of memory
fallbacks voor gymdata of cache. Zodra je de runtime start, verwacht de app
echte backends. In productie zijn deze variabelen verplicht:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `REDIS_URL`
- `CLAIMTECH_SESSION_SECRET`
- `CLAIMTECH_CSRF_SECRET`

Aanbevolen live-instellingen:

- `REDIS_URL` voor tenant cache over meerdere instances
- `APP_BASE_URL=https://jouw-gymos-domein.example` voor publieke
  Mollie webhooks en redirects
- `MOLLIE_WEBHOOK_SECRET` zodra Mollie is gekoppeld; betaalwebhooks zonder
  gedeelde secret worden in productie geweigerd
- `MOLLIE_TEST_MODE=true` zolang de Mollie OAuth-app in testfase draait
- `MOLLIE_CLIENT_ID`, `MOLLIE_CLIENT_SECRET` en
  `MOLLIE_CONNECT_REDIRECT_URL=https://jouw-gymos-domein.example/api/mollie/redirect`
  voor Mollie Connect OAuth
- `MOLLIE_ORGANIZATION_ACCESS_TOKEN` met `clients.write` voor Client Link
  onboarding van gyms die nog geen Mollie-account hebben
- optioneel `MOLLIE_API_KEY` als fallback voor profielgebonden test/live keys
- `MONGODB_BACKUP_POLICY=enabled` nadat automatische backups/PITR aanstaan
- `MIGRATIONS_LOCKED=true` wanneer database-migraties onderdeel zijn van de releaseflow
- `MONITORING_WEBHOOK_URL` of `SENTRY_DSN` voor error reporting
- `PUBLIC_TENANT_SLUGS=homegym` om publieke pagina's zoals `/reserve` en
  `/join` alleen de live gyms te laten tonen. Gebruik komma's voor meerdere
  publieke gyms.
- `ENABLE_REAL_UPLOADS=true` plus `SPACES_BUCKET`, `SPACES_ENDPOINT`,
  `SPACES_REGION`, `SPACES_ACCESS_KEY_ID` en `SPACES_SECRET_ACCESS_KEY` voor
  DigitalOcean Spaces. De app accepteert ook de DigitalOcean aliases
  `SPACES_ACCESS_KEY` en `SPACES_SECRET_KEY`, en normaliseert een endpoint
  zonder `https://`.
- juridische instellingen in `/dashboard/settings`: voorwaarden, privacy, SEPA,
  contract-PDF template en waiver-opslag

## Verificatie

Gebruik voor CI en releasechecks één sequentieel commando. Dit voorkomt dat
`typecheck` tegelijk met `build` aan `.next/types` werkt:

```bash
npm run ci:verify
```
