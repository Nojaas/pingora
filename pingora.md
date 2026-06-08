# pingora 🐝

> Microservice de notifications multi-canal — projet d'apprentissage fullstack

---

## Contexte et objectifs

Ce projet est un **exercice d'apprentissage personnel** conçu pour monter en compétences sur l'ensemble de la stack backend/infrastructure, en partant d'une base solide en React/Next.js.

L'idée : construire un service de notifications réaliste — le genre de brique qu'on retrouve dans quasiment tous les SaaS — en couvrant les patterns backend fondamentaux qu'on rencontre en production.

**Ce qu'on apprend ici :**

- Architecture microservice et découplage via files d'attente
- Conception d'une API REST sécurisée (auth, rate limiting, validation)
- Gestion de jobs asynchrones avec retry, backoff, dead-letter queues
- Webhooks (émission et réception)
- Conteneurisation Docker complète
- Tests backend (unitaires, intégration)
- Simulation d'un environnement cloud (LocalStack / AWS)

**Ce que ce projet n'est pas :** une app de prod. Mais elle est conçue pour _pouvoir_ l'être — scalabilité, sécurité et observabilité sont traitées sérieusement.

---

## Vue d'ensemble fonctionnelle

pingora expose une API qui permet à n'importe quelle application cliente d'envoyer des notifications à ses utilisateurs via plusieurs canaux :

```
Application cliente → API pingora → Queue BullMQ → Workers → Email / SMS / Push
                                                    ↓
                                              Webhooks sortants
                                         (livraison confirmée, échec...)
```

### Canaux supportés

| Canal    | Provider simulé                 | Statut |
| -------- | ------------------------------- | ------ |
| Email    | Resend (ou nodemailer en local) | ✅     |
| SMS      | Twilio (mock en dev)            | ✅     |
| Push web | Web Push API                    | 🔜     |
| Slack    | Slack Incoming Webhooks         | 🔜     |

---

## Stack technique

### Backend / Core

| Technologie                   | Usage           | Pourquoi                                                |
| ----------------------------- | --------------- | ------------------------------------------------------- |
| **Node.js** (ESM, TypeScript) | Runtime         | Écosystème npm, async natif                             |
| **Fastify**                   | Serveur HTTP    | Plus léger et rapide qu'Express, bon support TypeScript |
| **Prisma**                    | ORM             | Type-safety, migrations, bonne DX                       |
| **PostgreSQL**                | Base principale | Relations, fiabilité, JSON natif                        |
| **BullMQ**                    | Queue de jobs   | Built on Redis, retry/backoff, monitoring               |
| **Redis**                     | Broker + cache  | BullMQ, rate limiting, sessions                         |
| **Zod**                       | Validation      | Schémas partagés, inférence TypeScript                  |

### Infrastructure

| Technologie                 | Usage                                  |
| --------------------------- | -------------------------------------- |
| **Docker + Docker Compose** | Conteneurisation de tous les services  |
| **LocalStack**              | Simulation AWS (SES, SQS, S3) en local |
| **Bull Board**              | UI de monitoring des queues            |

### Tests

| Outil                | Usage                                     |
| -------------------- | ----------------------------------------- |
| **Vitest**           | Tests unitaires (rapide, config simple)   |
| **Jest + Supertest** | Tests d'intégration API                   |
| **testcontainers**   | PostgreSQL/Redis éphémères dans les tests |

### Frontend (léger — dashboard de monitoring)

| Outil                  | Usage                 |
| ---------------------- | --------------------- |
| **Next.js App Router** | Dashboard interne     |
| **Tanstack Query**     | Fetching état serveur |
| **Zustand**            | État UI local         |

---

## Architecture détaillée

### Structure du projet

```
pingora/
├── apps/
│   ├── api/                    # Serveur Fastify — API REST principale
│   │   ├── src/
│   │   │   ├── routes/         # Endpoints REST (/notifications, /webhooks, /keys)
│   │   │   ├── plugins/        # Auth, rate-limit, cors, swagger
│   │   │   ├── schemas/        # Schemas Zod (validation + inférence types)
│   │   │   └── services/       # Logique métier (NotificationService, WebhookService)
│   │   └── Dockerfile
│   │
│   ├── worker/                 # Process BullMQ séparé
│   │   ├── src/
│   │   │   ├── queues/         # Définition des queues (email, sms, webhook)
│   │   │   ├── processors/     # Handlers par canal
│   │   │   └── providers/      # Adaptateurs (Resend, Twilio, etc.)
│   │   └── Dockerfile
│   │
│   └── dashboard/              # Next.js — monitoring interne
│       └── src/
│           ├── app/
│           └── components/
│
├── packages/
│   ├── db/                     # Prisma schema, migrations, client partagé
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       └── index.ts        # Client exporté
│   │
│   └── shared/                 # Types et schémas Zod partagés entre apps
│       └── src/
│           ├── schemas/
│           └── types/
│
├── infra/
│   ├── docker-compose.yml      # Stack locale complète
│   ├── docker-compose.test.yml # Stack pour les tests d'intégration
│   └── localstack/             # Config AWS simulé
│
└── .github/
    └── workflows/
        └── ci.yml              # Pipeline CI (lint → test → build → docker push)
```

### Schéma de base de données (Prisma)

```prisma
model ApiKey {
  id          String   @id @default(cuid())
  name        String
  keyHash     String   @unique   // On stocke le hash, jamais la clé en clair
  prefix      String             // Les 8 premiers chars pour l'identifier (nfh_xxxx...)
  scopes      String[]           // ["notifications:write", "webhooks:read", ...]
  rateLimit   Int      @default(1000)
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revoked     Boolean  @default(false)
  notifications Notification[]
}

model Notification {
  id          String             @id @default(cuid())
  apiKeyId    String
  apiKey      ApiKey             @relation(fields: [apiKeyId], references: [id])
  channel     Channel            // EMAIL | SMS | PUSH
  recipient   String             // email ou numéro
  subject     String?
  body        String
  status      NotificationStatus @default(PENDING)
  attempts    Int                @default(0)
  metadata    Json?              // données custom du client
  jobId       String?            // référence BullMQ
  sentAt      DateTime?
  failedAt    DateTime?
  error       String?
  createdAt   DateTime           @default(now())
  webhookDeliveries WebhookDelivery[]
}

model WebhookEndpoint {
  id          String   @id @default(cuid())
  url         String
  secret      String   // Pour signer les payloads (HMAC-SHA256)
  events      String[] // ["notification.sent", "notification.failed", ...]
  active      Boolean  @default(true)
  apiKeyId    String
  createdAt   DateTime @default(now())
  deliveries  WebhookDelivery[]
}

model WebhookDelivery {
  id             String          @id @default(cuid())
  endpointId     String
  endpoint       WebhookEndpoint @relation(fields: [endpointId], references: [id])
  notificationId String
  notification   Notification    @relation(fields: [notificationId], references: [id])
  event          String
  payload        Json
  statusCode     Int?
  attempts       Int             @default(0)
  nextRetryAt    DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime        @default(now())
}

enum Channel {
  EMAIL
  SMS
  PUSH
}

enum NotificationStatus {
  PENDING
  QUEUED
  SENT
  FAILED
  CANCELLED
}
```

### Flow d'une notification

```
1. POST /notifications
   ├── Auth via API Key (header: x-api-key)
   ├── Rate limiting (sliding window via Redis)
   ├── Validation Zod du body
   ├── Insertion en DB (status: PENDING)
   └── Ajout dans la queue BullMQ (status: QUEUED)

2. Worker consomme le job
   ├── Sélection du provider selon le canal
   ├── Envoi (avec timeout)
   ├── Mise à jour DB (status: SENT | FAILED)
   └── Si succès → émission webhook "notification.sent"

3. Retry automatique BullMQ
   ├── Backoff exponentiel (1s → 2s → 4s → 8s → 16s)
   ├── Max 5 tentatives
   └── Après 5 échecs → Dead Letter Queue + webhook "notification.failed"

4. Webhook delivery (queue séparée)
   ├── Signature HMAC-SHA256 du payload
   ├── POST vers l'URL du client avec timeout 10s
   └── Retry si 5xx ou timeout (3 tentatives max)
```

---

## API REST — endpoints principaux

### Authentification

Toutes les routes (sauf `/health`) nécessitent un header :

```
x-api-key: nfh_xxxxxxxxxxxxxxxxxxxx
```

### Endpoints

```
POST   /notifications              Envoyer une notification
GET    /notifications              Lister (filtres: status, channel, cursor pagination)
GET    /notifications/:id          Détail + historique des tentatives

POST   /webhooks/endpoints         Enregistrer un endpoint webhook
GET    /webhooks/endpoints         Lister ses endpoints
DELETE /webhooks/endpoints/:id     Supprimer
GET    /webhooks/deliveries        Historique des livraisons

POST   /keys                       Créer une API key (admin only)
GET    /keys                       Lister ses clés
DELETE /keys/:id                   Révoquer

GET    /health                     Health check (public)
GET    /metrics                    Métriques Prometheus (interne)
```

### Exemple de requête

```bash
curl -X POST https://api.pingora.local/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: nfh_test_abc123" \
  -d '{
    "channel": "email",
    "recipient": "user@example.com",
    "subject": "Votre commande est confirmée",
    "body": "Bonjour, votre commande #1234 a bien été reçue.",
    "metadata": {
      "orderId": "1234",
      "userId": "usr_xyz"
    }
  }'
```

### Exemple de réponse

```json
{
  "id": "notif_clxyz123",
  "status": "queued",
  "channel": "email",
  "recipient": "user@example.com",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "_links": {
    "self": "/notifications/notif_clxyz123",
    "cancel": "/notifications/notif_clxyz123/cancel"
  }
}
```

---

## Démarrage

### Prérequis

- Docker Desktop ≥ 4.x
- Node.js ≥ 20 (LTS)
- pnpm ≥ 9

### Lancer l'environnement local

```bash
# 1. Cloner et installer les dépendances
git clone https://github.com/you/pingora.git
cd pingora
pnpm install

# 2. Variables d'environnement
cp .env.example .env

# 3. Démarrer l'infra (PostgreSQL, Redis — LocalStack et Bull Board arrivent en phase 4)
pnpm infra:up

# 4. Migrations Prisma
pnpm db:migrate

# 5. Seed — crée une API key de test
pnpm db:seed

# 6. Démarrer l'API et le worker en dev
pnpm dev
```

### Services disponibles en local

| Service             | URL                        |
| ------------------- | -------------------------- |
| API REST            | http://localhost:3000      |
| Swagger UI          | http://localhost:3000/docs |
| Bull Board (queues) | http://localhost:3001      |
| Dashboard Next.js   | http://localhost:3002      |
| PostgreSQL          | localhost:5432             |
| Redis               | localhost:6379             |
| LocalStack (AWS)    | http://localhost:4566      |

---

## Tests

```bash
# Tests unitaires (Vitest — rapide, watch mode)
pnpm test:unit

# Tests d'intégration (lance une DB/Redis éphémères via testcontainers)
pnpm test:integration

# Tous les tests + coverage
pnpm test

# E2E leger (Supertest, pas de browser)
pnpm test:e2e
```

### Ce qu'on teste

- **Unitaires** : services, validators Zod, logique de retry, signature HMAC
- **Intégration** : routes HTTP complètes (auth, rate limiting, happy path, edge cases)
- **Worker** : comportement des processors avec providers mockés

---

## Variables d'environnement

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pingora

# Redis
REDIS_URL=redis://localhost:6379

# Auth interne (pour créer des clés admin au seed)
ADMIN_SECRET=change_me_in_prod

# Email (Resend en prod, nodemailer en dev)
EMAIL_PROVIDER=nodemailer
RESEND_API_KEY=

# SMS (Twilio — utilise un mock en dev)
SMS_PROVIDER=mock
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# AWS / LocalStack
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

---

## Roadmap du projet

Les features sont découpées en phases pour progresser étape par étape.

### Phase 1 — Fondations

- [x] Setup monorepo (pnpm workspaces + Turborepo)
- [x] Schéma Prisma + migrations
- [x] Serveur Fastify avec plugin auth (API key)
- [x] Route `POST /notifications` — validation Zod
- [x] Intégration BullMQ — queue email basique
- [x] Worker email avec Nodemailer
- [x] Tests unitaires du service de notification

### Phase 2 — Robustesse

- [ ] Retry avec backoff exponentiel
- [ ] Dead Letter Queue + alertes
- [ ] Rate limiting par API key (sliding window Redis)
- [ ] Route `GET /notifications` avec cursor pagination
- [ ] Tests d'intégration (routes + auth)

### Phase 3 — Webhooks

- [ ] Endpoints webhook (CRUD)
- [ ] Signature HMAC-SHA256
- [ ] Queue webhook avec retry
- [ ] Réception de webhooks externes (parsing + vérification signature)

### Phase 4 — Infra & Observabilité

- [ ] Dockerfiles multi-stage (dev/prod)
- [ ] `docker-compose.yml` complet avec healthchecks
- [ ] Logs structurés (pino)
- [ ] Métriques Prometheus (`/metrics`)
- [ ] Simulation LocalStack SES

### Phase 5 — Dashboard & CI/CD

- [ ] Dashboard Next.js (liste notifs, statut queues)
- [ ] Tanstack Query + Zustand
- [ ] Pipeline GitHub Actions (lint → test → build → push image)

---

## Concepts clés abordés

### BullMQ / Redis

Le choix de BullMQ plutôt qu'une solution simple (ex: pg-boss) est délibéré. On apprend à gérer plusieurs queues, les priorités, le backoff configurable, et le monitoring via Bull Board. Redis sert à la fois de broker pour BullMQ et de store pour le rate limiting.

### Webhooks (émission)

Émettre des webhooks correctement c'est plus subtil qu'un simple HTTP call : il faut signer le payload pour que le client puisse vérifier l'origine, gérer les timeouts, retry en cas d'échec serveur côté destinataire, et maintenir un historique de livraison consultable.

### RBAC léger via scopes

Chaque API key porte des scopes (`notifications:write`, `webhooks:read`, etc.). C'est une forme simple de RBAC qui suffit pour un service comme celui-ci, et qui prépare aux implémentations plus avancées du projet 4.

### Cursor pagination

On évite l'offset pagination (qui devient lente sur de grands datasets) et on implémente une cursor-based pagination via l'id Prisma — pattern standard dans les APIs modernes.

---

## Ressources utiles

- [BullMQ docs](https://docs.bullmq.io)
- [Prisma docs](https://www.prisma.io/docs)
- [Fastify docs](https://fastify.dev/docs)
- [LocalStack docs](https://docs.localstack.cloud)
- [Zod docs](https://zod.dev)
- [Vitest docs](https://vitest.dev)
