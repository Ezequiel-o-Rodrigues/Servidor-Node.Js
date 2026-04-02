import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { randomUUID } from "crypto";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  const start = Date.now();

  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      },
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
