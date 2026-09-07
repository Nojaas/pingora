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
| `POST` | `/notifications` | Enqueue email (scopes) |
| `GET` | `/notifications` | Cursor pagination |
| `POST/GET/DELETE` | `/webhooks/endpoints` | CRUD endpoints sortants |
| `POST` | `/webhooks/inbound` | Public + HMAC + idempotence |

Dashboard : `pnpm dev:dashboard` → http://localhost:3002 (nécessite `PINGORA_API_KEY` dans `.env`).

Détail des contrats et variables : [`.env.example`](./.env.example).

---

## Qualité & tests

```bash
pnpm check-types
pnpm test:unit
pnpm test:integration
pnpm build
```

- Unitaires : Vitest (shared, api services, worker processors)
- Intégration : Fastify `inject` (auth, notifications, webhooks, metrics)

---

## Branches

| Branche | Rôle |
| ------- | ---- |
| `main` | Stable |
| `develop` | Intégration |
| `feat/*` | Features → PR vers `develop` |

---

## Documentation

| Document | Contenu |
| -------- | ------- |
| [`.env.example`](./.env.example) | Variables d’environnement |
| `infra/docker-compose.yml` | Stack locale (Postgres, Redis, Mailpit, LocalStack) |

---

## Statut

Phases 1–4 livrées (API + worker email, retry/DLQ, webhooks, Docker, logs, métriques, LocalStack SES).  
Phase 5 en cours : dashboard Next.js (liste + queues, TanStack Query / Zustand) ; CI/CD ensuite.
