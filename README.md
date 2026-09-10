# pingora

Microservice de notifications multi-canal — API asynchrone, files d’attente, webhooks, observabilité.

Pingora découple l’émission d’une notification de sa livraison : l’API enregistre et enqueue, un worker délivre (email aujourd’hui), et des webhooks signés notifient le client du résultat.

```
Client ──x-api-key──► API (Fastify)
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Postgres     Redis     BullMQ
                                   │
                                   ▼
                               Worker
                         ┌─────┴─────┐
                         ▼           ▼
                      Email       Webhooks
                   (SMTP / SES)   (HMAC POST)
```

---

## Stack

| Couche | Choix |
| ------ | ----- |
| Runtime | Node.js ≥ 20, TypeScript (ESM) |
| API | Fastify 5 |
| Données | PostgreSQL + Prisma 7 |
| Jobs | BullMQ + Redis |
| Validation / contrats | Zod (`@pingora/shared`) |
| Monorepo | pnpm workspaces + Turborepo |
| Infra locale | Docker Compose (Postgres, Redis, Mailpit, LocalStack) |
| Observabilité | Pino, Prometheus (`GET /metrics`) |

---

## Structure

```
apps/
  api/          # REST — auth API key, rate limit, routes métier
  worker/       # Consumers BullMQ (email, DLQ, webhook)
  dashboard/    # Next.js monitoring (TanStack Query + Zustand)
packages/
  db/           # Prisma schema, migrations, client
  shared/       # Schémas Zod, queues, HMAC, logger
infra/
  docker-compose.yml
  localstack/   # Init SES (identités vérifiées)
```

---

## Prérequis

- Node.js ≥ 20
- pnpm 10 (`packageManager` piné dans `package.json`)
- Docker Desktop

---

## Démarrage rapide

```bash
pnpm install
cp .env.example .env

pnpm infra:up              # Postgres, Redis, Mailpit, LocalStack
pnpm db:migrate:deploy
pnpm db:seed               # affiche une API key — à conserver

pnpm dev                   # API :3000 + worker (watch)
```

Vérification :

```bash
curl http://localhost:3000/health
```

Envoi d’une notification :

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: <clé du seed>" \
  -d '{
    "channel": "email",
    "recipient": "user@example.com",
    "subject": "Test pingora",
    "body": "Hello!"
  }'
```

Emails en local : [http://localhost:8025](http://localhost:8025) (Mailpit).

---

## Modes d’exécution

| Mode | Commande | Usage |
| ---- | -------- | ----- |
| Hybride (recommandé) | `pnpm infra:up` + `pnpm dev` | Dev quotidien — hot reload |
| Stack Docker prod-like | `pnpm docker:up` | Smoke déploiement local |
| Email SMTP | `EMAIL_PROVIDER=nodemailer` | Défaut — Mailpit |
| Email SES | `EMAIL_PROVIDER=ses` | Simulation AWS via LocalStack (`/_aws/ses`) |

---

## API (aperçu)

Auth : header `x-api-key` (sauf routes publiques / internes).

| Méthode | Route | Notes |
| ------- | ----- | ----- |
| `GET` | `/health` | Public |
| `GET` | `/metrics` | Interne — Bearer / `x-metrics-token` |
| `GET` | `/queues` | Compteurs BullMQ (email, email-dlq, webhook) |
| `GET` | `/dashboard/summary` | KPIs (succès, latence, DLQ) |
| `POST` | `/notifications` | Enqueue email (scopes) |
| `GET` | `/notifications` | Cursor pagination |
| `GET` | `/webhooks/deliveries` | Historique deliveries (succès / retry / échec) |
| `POST/GET/DELETE` | `/webhooks/endpoints` | CRUD endpoints sortants |
| `POST` | `/webhooks/inbound` | Public + HMAC + idempotence |

Dashboard : `pnpm dev:dashboard` → http://localhost:3002 (nécessite `PINGORA_API_KEY` dans `.env`).

Détail des contrats et variables : [`.env.example`](./.env.example).

---

## Qualité & tests

```bash
pnpm lint
pnpm check-types
pnpm test:unit
pnpm test:integration
pnpm test:containers
pnpm build
```

- Lint / format : Biome (`pnpm lint`, `pnpm lint:fix`)
- Unitaires : Vitest (shared, api services, worker processors)
- Intégration mockée : Fastify `inject` (auth, notifications, webhooks, metrics)
- Intégration containers : Testcontainers Postgres + Redis (`pnpm test:containers`, Docker requis)
- CI : [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — lint → unit + containers → build → images GHCR

---

## Branches

| Branche | Rôle |
| ------- | ---- |
| `main` | Stable |
| `develop` | Intégration |
| `feat/*` | Features → PR vers `develop` |

---

## Déploiement (Railway)

API + worker + Postgres + Redis. Le dashboard reste en local.

Guide pas à pas : [`infra/railway.md`](./infra/railway.md).

Résumé :

1. Projet Railway → plugins **PostgreSQL** + **Redis**
2. Deux services depuis le même repo : config `/apps/api/railway.json` et `/apps/worker/railway.json`
3. Variables partagées (dont `DATABASE_URL` / `REDIS_URL` en références Railway) + **Resend SMTP**
4. Depuis le laptop : `prisma migrate deploy` + `pnpm db:seed` contre la DB Railway
5. Domaine public sur **api** uniquement → smoke `GET /health` + `POST /notifications`

---

## Documentation

| Document | Contenu |
| -------- | ------- |
| [`.env.example`](./.env.example) | Variables d’environnement |
| [`infra/docker-compose.yml`](./infra/docker-compose.yml) | Stack locale (Postgres, Redis, Mailpit, LocalStack) |
| [`infra/railway.md`](./infra/railway.md) | Déploiement Railway + Resend |

---

## Statut

Phases 1–5 livrées (API + worker, webhooks, Docker, observabilité, dashboard monitoring, CI/CD GHCR). Déploiement Railway documenté.

