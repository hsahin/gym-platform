# ClaimTech Gym Platform

Single-app sportschoolplatform op Next.js 14, gebouwd bovenop remote `@claimtech/*`
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
- `@claimtech/ui@0.2.3`
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
- `@claimtech/ui`: dashboard UI, dialogs, tabs, metric cards en form controls

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

Daarna log je in met echte teamaccounts en beheer je de gym vanuit aparte
dashboardpagina's zoals `/dashboard/members`, `/dashboard/contracts`,
`/dashboard/payments`, `/dashboard/smartdoors`, `/dashboard/locations` en
`/dashboard/staff`.

## Productie-eisen

De app draait bewust niet op local state, browser localStorage of memory
fallbacks voor gymdata of cache. Zodra je de runtime start, verwacht de app
echte backends. In productie zijn deze variabelen verplicht:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `REDIS_URL`
- `CLAIMTECH_SESSION_SECRET`

Aanbevolen live-instellingen:

- `REDIS_URL` voor tenant cache over meerdere instances
- `MONGODB_BACKUP_POLICY=enabled` nadat automatische backups/PITR aanstaan
- `MIGRATIONS_LOCKED=true` wanneer database-migraties onderdeel zijn van de releaseflow
- `MONITORING_WEBHOOK_URL` of `SENTRY_DSN` voor error reporting
- juridische instellingen in `/dashboard/settings`: voorwaarden, privacy, SEPA,
  contract-PDF template en waiver-opslag

## Verificatie

Deze checks zijn al succesvol gedraaid:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```
