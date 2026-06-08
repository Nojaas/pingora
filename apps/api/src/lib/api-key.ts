import { hashApiKey, isApiKeyFormat } from "@pingora/shared";
import { prisma } from "@pingora/db";
import type { ApiKeyContext } from "../types/fastify.js";

export async function resolveApiKey(
  rawKey: string,
): Promise<ApiKeyContext | null> {
  if (!isApiKeyFormat(rawKey)) {
    return null;
  }

  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      rateLimit: true,
      revoked: true,
      expiresAt: true,
    },
  });

  if (!record || record.revoked) {
    return null;
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  const { revoked: _revoked, expiresAt: _expiresAt, ...apiKey } = record;

  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      /* best-effort — ne bloque pas la requête */
    });

  return apiKey;
}

export function hasScope(apiKey: ApiKeyContext, scope: string): boolean {
  return apiKey.scopes.includes(scope);
}

export function hasEveryScope(
  apiKey: ApiKeyContext,
  scopes: readonly string[],
): boolean {
  return scopes.every((scope) => apiKey.scopes.includes(scope));
}
