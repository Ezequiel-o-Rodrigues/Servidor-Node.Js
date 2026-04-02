import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { env } from "../config/env";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, "Erro na requisição");

  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Dados inválidos", details: err.issues });
  }

  if (err.name === "UnauthorizedError" || err.status === 401) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  if (err.status === 403) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  res.status(err.status || 500).json({
    error: env.NODE_ENV === "production" ? "Erro interno do servidor" : err.message,
  });
}
