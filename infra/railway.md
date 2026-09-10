# Railway deployment checklist (API + worker)
#
# Dashboard stays local: set PINGORA_API_URL to the public API URL.
#
# 1) Project
#    - New project on railway.com
#    - Add plugins: PostgreSQL + Redis
#
# 2) Services (same GitHub repo, root = repo root)
#    - api    → Settings → Config as Code: /apps/api/railway.json
#    - worker → Settings → Config as Code: /apps/worker/railway.json
#    - Generate a public domain on **api** only
#
# 3) Shared variables (api + worker) — use Raw Editor or Shared Variables
#
# DATABASE_URL=${{Postgres.DATABASE_URL}}
# REDIS_URL=${{Redis.REDIS_URL}}
# NODE_ENV=production
# PORT=3000
# LOG_LEVEL=info
# ADMIN_SECRET=<openssl rand -hex 32>
# METRICS_SECRET=<openssl rand -hex 32>
# INBOUND_WEBHOOK_SECRET=<openssl rand -hex 32>
# EMAIL_PROVIDER=nodemailer
# SMTP_HOST=smtp.resend.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=resend
# SMTP_PASS=<RESEND_API_KEY>
# SMTP_FROM=onboarding@resend.dev   # or a verified domain sender
# SMS_PROVIDER=mock
#
# 4) Migrate + seed (from your laptop, with Railway Postgres URL)
#
#    export DATABASE_URL='postgresql://…'   # from Railway Postgres → Connect
#    pnpm --filter @pingora/db exec prisma migrate deploy
#    pnpm db:seed                           # copy the printed API key
#
# 5) Smoke
#
#    curl https://<api>.up.railway.app/health
#    curl -X POST https://<api>.up.railway.app/notifications \
#      -H "Content-Type: application/json" \
#      -H "x-api-key: <seed key>" \
#      -d '{"channel":"email","recipient":"you@example.com","subject":"Railway","body":"ok"}'
#
# 6) Local dashboard against Railway
#
#    PINGORA_API_URL=https://<api>.up.railway.app
#    PINGORA_API_KEY=<seed key>
#    pnpm dev:dashboard
