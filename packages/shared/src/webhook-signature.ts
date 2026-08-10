import { createHmac, timingSafeEqual } from "node:crypto";

/** Header envoyé sur chaque livraison webhook sortante / attendu en entrée. */
export const WEBHOOK_SIGNATURE_HEADER = "x-pingora-signature" as const;

/** Préfixe du schéma de signature (HMAC-SHA256, digest hex). */
export const WEBHOOK_SIGNATURE_SCHEME = "v1" as const;

export type SignedWebhook = {
  /** Valeur complète du header, ex. `t=1710000000,v1=abc...` */
  header: string;
  timestamp: number;
  signature: string;
};

export type VerifyWebhookSignatureOptions = {
  /** Rejette les signatures trop anciennes (anti-replay). Défaut : 300s. */
  toleranceSeconds?: number;
  /** Horloge injectable pour les tests. */
  now?: number;
};

/**
 * Construit le message canonique signé :
 * `${unixSeconds}.${rawBody}`
 */
export function buildWebhookSignedPayload(
  timestamp: number,
  rawBody: string,
): string {
  return `${timestamp}.${rawBody}`;
}

/**
 * HMAC-SHA256 du payload canonique, digest **hex** (stable, lisible).
 */
export function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestamp = Math.floor(Date.now() / 1000),
): SignedWebhook {
  if (!secret) {
    throw new Error("Webhook secret is required");
  }

  const signature = createHmac("sha256", secret)
    .update(buildWebhookSignedPayload(timestamp, rawBody), "utf8")
    .digest("hex");

  return {
    header: `t=${timestamp},${WEBHOOK_SIGNATURE_SCHEME}=${signature}`,
    timestamp,
    signature,
  };
}

/**
 * Parse `t=<unix>,v1=<hex>` (ordre flexible, ignore les paires inconnues).
 */
export function parseWebhookSignatureHeader(header: string): {
  timestamp: number;
  signature: string;
} | null {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp: number | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      timestamp = parsed;
    }

    if (key === WEBHOOK_SIGNATURE_SCHEME) {
      signature = value;
    }
  }

  if (timestamp === undefined || !signature) {
    return null;
  }

  return { timestamp, signature };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Vérifie une signature webhook.
 * Retourne `false` si header invalide, secret faux, body altéré, ou timestamp hors tolérance.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  header: string,
  options: VerifyWebhookSignatureOptions = {},
): boolean {
  if (!secret || !header) {
    return false;
  }

  const parsed = parseWebhookSignatureHeader(header);
  if (!parsed) {
    return false;
  }

  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(buildWebhookSignedPayload(parsed.timestamp, rawBody), "utf8")
    .digest("hex");

  return safeEqualHex(expected, parsed.signature);
}
