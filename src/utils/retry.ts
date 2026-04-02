import { logger } from "../config/logger";

interface RetryOptions {
  attempts: number;
  delayMs: number;
  backoff: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { attempts: 3, delayMs: 500, backoff: 2 }
): Promise<T> {
  let lastError: Error = new Error("Retry failed");
  let delay = options.delayMs;

  for (let i = 1; i <= options.attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      logger.warn(
        { attempt: i, max: options.attempts, err: err.message },
        "Tentativa falhou, retentando..."
      );
      if (i < options.attempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= options.backoff;
      }
    }
  }
  throw lastError;
}
