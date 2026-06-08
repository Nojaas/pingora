import { randomBytes } from "node:crypto";
import { hashApiKey, SCOPES } from "@pingora/shared";
import { prisma } from "./client.js";

const DEFAULT_SCOPES = [
  SCOPES.NOTIFICATIONS_WRITE,
  SCOPES.NOTIFICATIONS_READ,
  SCOPES.WEBHOOKS_READ,
  SCOPES.WEBHOOKS_WRITE,
] as const;

function generateApiKey(): { rawKey: string; prefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const rawKey = `nfh_test_${secret}`;
  const prefix = rawKey.slice(0, 12);
  return { rawKey, prefix };
}

async function main() {
  const existing = await prisma.apiKey.findFirst({
    where: { name: "Development", revoked: false },
  });

  if (existing) {
    console.log(
      "[seed] API key de développement déjà présente (prefix: %s).",
      existing.prefix,
    );
    console.log(
      "[seed] Supprime-la ou révoque-la pour en régénérer une nouvelle.",
    );
    return;
  }

  const { rawKey, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      name: "Development",
      keyHash: hashApiKey(rawKey),
      prefix,
      scopes: [...DEFAULT_SCOPES],
      rateLimit: 1000,
    },
  });

  console.log("[seed] API key de développement créée.");
  console.log("[seed] Copie cette clé — elle ne sera plus affichée :");
  console.log("");
  console.log(`  ${rawKey}`);
  console.log("");
  console.log("[seed] Header: x-api-key: <clé ci-dessus>");
}

main()
  .catch((error) => {
    console.error("[seed] Échec:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
