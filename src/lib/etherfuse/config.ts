export type EnvTier = "local" | "sandbox" | "production";

export type EnvVarSpec = {
  name: string;
  tiers: EnvTier[];
  required: boolean;
  defaultValue?: string;
  description: string;
};

/** Environment_Matrix — single source of truth for all Etherfuse env vars. */
export const ETHERFUSE_ENV_MATRIX: EnvVarSpec[] = [
  {
    name: "ETHERFUSE_API_KEY",
    tiers: ["local", "sandbox", "production"],
    required: true,
    description: "API key for Etherfuse (no Bearer prefix). See .env.example.",
  },
  {
    name: "ETHERFUSE_API_BASE_URL",
    tiers: ["local", "sandbox", "production"],
    required: false,
    defaultValue: "https://api.sand.etherfuse.com",
    description: "Base URL for Etherfuse API. Must start with https://.",
  },
  {
    name: "ETHERFUSE_WEBHOOK_SECRET",
    tiers: ["production"],
    required: true,
    description: "Base64 HMAC secret for webhook signature verification.",
  },
  {
    name: "SEYF_ALLOW_ETHERFUSE_RAMP",
    tiers: ["production"],
    required: true,
    description: 'Must be "true" to enable ramp routes in production.',
  },
  {
    name: "ETHERFUSE_DEFAULT_BLOCKCHAIN",
    tiers: ["local", "sandbox", "production"],
    required: false,
    defaultValue: "stellar",
    description: "Default blockchain for ramp operations.",
  },
  {
    name: "ETHERFUSE_ONRAMP_TARGET_ASSET",
    tiers: ["local", "sandbox"],
    required: false,
    description: "Override for onramp target asset identifier.",
  },
  {
    name: "ETHERFUSE_OFFRAMP_SOURCE_ASSET",
    tiers: ["local", "sandbox"],
    required: false,
    description: "Override for offramp source asset identifier.",
  },
];

export type EtherfuseConfig = {
  /** Validated base URL, trailing slash stripped, must start with https://. */
  baseUrl: string;
  /** Non-empty API key. */
  apiKey: string;
  /** HMAC secret for webhook verification; null when not configured (non-production only). */
  webhookSecret: string | null;
  /** Whether ramp routes are enabled (SEYF_ALLOW_ETHERFUSE_RAMP === "true"). */
  allowRamp: boolean;
};

/**
 * Si es true, aplicamos checklist completo (webhook + ramp): producción “real”.
 *
 * `NODE_ENV` es `production` en cualquier build desplegado, también en entornos
 * de prueba (staging, previews), donde no quieres exigir la configuración
 * completa de producción (hoy, `SEYF_ALLOW_ETHERFUSE_RAMP=true`). El entorno se declara con `SEYF_DEPLOY_ENV`
 * (`production` | `preview` | `development`), independiente de la plataforma.
 * Mientras Vercel siga activo se respeta también `VERCEL_ENV`.
 * Sin ninguna de las dos, un build de producción se trata como producción.
 */
export function strictEtherfuseProductionConfig(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const v = process.env.SEYF_DEPLOY_ENV?.trim() || process.env.VERCEL_ENV;
  if (v === "preview" || v === "development") return false;
  return true;
}

/**
 * Validates all Etherfuse env vars and returns a typed config object.
 * Collects ALL validation errors before throwing (fail-fast, not fail-first).
 */
export function getEtherfuseConfig(): EtherfuseConfig {
  const errors: string[] = [];
  const strictProd = strictEtherfuseProductionConfig();

  // --- ETHERFUSE_API_KEY: required always, must be non-empty ---
  const apiKey = process.env.ETHERFUSE_API_KEY?.trim() ?? "";
  if (!apiKey) {
    errors.push("ETHERFUSE_API_KEY: missing or empty. See .env.example.");
  }

  // --- ETHERFUSE_API_BASE_URL: optional, default provided, must start with https:// if set ---
  const rawBaseUrl = process.env.ETHERFUSE_API_BASE_URL?.trim();
  const defaultBaseUrl = "https://api.sand.etherfuse.com";
  let baseUrl: string;

  if (rawBaseUrl && rawBaseUrl.length > 0) {
    if (!rawBaseUrl.startsWith("https://")) {
      errors.push(
        `ETHERFUSE_API_BASE_URL: must start with https://. Got: "${rawBaseUrl}"`,
      );
      baseUrl = rawBaseUrl; // placeholder; will throw before returning
    } else {
      baseUrl = rawBaseUrl.replace(/\/$/, "");
    }
  } else {
    baseUrl = defaultBaseUrl;
  }

  // --- ETHERFUSE_WEBHOOK_SECRET: optional here; webhook route enforces it when needed ---
  const webhookSecretRaw = process.env.ETHERFUSE_WEBHOOK_SECRET?.trim() ?? "";
  const webhookSecret: string | null = webhookSecretRaw || null;

  // --- SEYF_ALLOW_ETHERFUSE_RAMP: must be "true" in production ---
  const allowRampRaw =
    process.env.SEYF_ALLOW_ETHERFUSE_RAMP?.trim() ??
    process.env.SEYF_ALLOW_ETHERFUSE_RAMP?.trim();
  const allowRamp = allowRampRaw === "true";

  if (strictProd && !allowRamp) {
    errors.push(
      'SEYF_ALLOW_ETHERFUSE_RAMP (o SEYF_ALLOW_ETHERFUSE_RAMP): must be "true" to enable ramp routes in production.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Etherfuse config validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return {
    baseUrl,
    apiKey,
    webhookSecret,
    allowRamp,
  };
}

/** @deprecated Use getEtherfuseConfig().baseUrl instead. */
export function getEtherfuseBaseUrl(): string {
  const raw = process.env.ETHERFUSE_API_BASE_URL?.trim();
  const defaultBase = "https://api.sand.etherfuse.com";
  return (raw && raw.length > 0 ? raw : defaultBase).replace(/\/$/, "");
}
