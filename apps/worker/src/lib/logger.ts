import { createLogger, LOG_SERVICES, type Logger } from "@pingora/shared";

export const logger: Logger = createLogger(LOG_SERVICES.WORKER);

export function childLogger(component: string): Logger {
  return logger.child({ component });
}
