import pino, { type Logger, type LoggerOptions } from "pino";
import { PINGORA_VERSION } from "./version.js";

export const LOG_SERVICES = {
  API: "pingora-api",
  WORKER: "pingora-worker",
} as const;

export type PingoraService =
  (typeof LOG_SERVICES)[keyof typeof LOG_SERVICES];

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export function resolveLogLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && LOG_LEVELS.includes(configured as LogLevel)) {
    return configured as LogLevel;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function buildLoggerOptions(service: PingoraService): LoggerOptions {
  const level = resolveLogLevel();
  const isDev = process.env.NODE_ENV !== "production";

  return {
    level,
    base: {
      service,
      version: PINGORA_VERSION,
    },
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname,service,version",
              singleLine: false,
            },
          },
        }
      : {}),
  };
}

export function createLogger(service: PingoraService): Logger {
  return pino(buildLoggerOptions(service));
}

export type FastifyLoggerOption = LoggerOptions | false;

export function createFastifyLogger(
  service: PingoraService,
  enabled = true,
): FastifyLoggerOption {
  if (!enabled) {
    return false;
  }

  return buildLoggerOptions(service);
}
