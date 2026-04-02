import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.error("Redis: máximo de tentativas atingido");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", () => logger.info("Redis conectado"));
    redis.on("error", (err) => logger.error({ err }, "Erro no Redis"));
  }

  return redis;
}

export async function checkRedis(): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    await r.ping();
    return true;
  } catch {
    return false;
  }
}
