import { Router, Express } from "express";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./config/logger";
import { query } from "./config/database";

export interface ModuleDefinition {
  slug: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  menuOrder?: number;
  router: Router;
  frontendPath?: string;
}

export type ModuleRegister = () => ModuleDefinition;

export async function loadModules(app: Express): Promise<ModuleDefinition[]> {
  const modulesDir = path.join(__dirname, "modules");
  const loaded: ModuleDefinition[] = [];

  if (!fs.existsSync(modulesDir)) {
    logger.warn("Diretório de módulos não encontrado");
    return loaded;
  }

  const dirs = fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const indexPath = path.join(modulesDir, dir, "index");

    try {
      const moduleExport = require(indexPath);
      const register: ModuleRegister = moduleExport.register || moduleExport.default;

      if (typeof register !== "function") {
        logger.warn(`Módulo '${dir}' não exporta uma função register, pulando...`);
        continue;
      }

      const definition = register();

      // Checar se módulo está habilitado no banco
      try {
        const result = await query(
          "SELECT enabled FROM modules WHERE slug = $1",
          [definition.slug]
        );
        if (result.rows.length > 0 && !result.rows[0].enabled) {
          logger.info(`Módulo '${definition.slug}' desabilitado, pulando...`);
          continue;
        }
      } catch {
        // Banco pode não estar disponível ainda, carrega mesmo assim
      }

      // Montar rotas da API do módulo
      app.use(`/api/${definition.slug}`, definition.router);

      // Servir frontend do módulo se existir
      const frontendDir = path.join(modulesDir, dir, "frontend");
      if (fs.existsSync(frontendDir)) {
        definition.frontendPath = frontendDir;
        const express = require("express");
        app.use(`/m/${definition.slug}`, express.static(frontendDir));
      }

      loaded.push(definition);
      logger.info(
        `Módulo carregado: ${definition.name} v${definition.version} [${definition.slug}]`
      );
    } catch (err: any) {
      logger.error({ err: err.message, module: dir }, `Erro ao carregar módulo '${dir}'`);
    }
  }

  // Registrar/atualizar módulos no banco
  try {
    for (const mod of loaded) {
      await query(
        `INSERT INTO modules (slug, name, description, version, icon, menu_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           version = EXCLUDED.version,
           icon = COALESCE(EXCLUDED.icon, modules.icon),
           updated_at = NOW()`,
        [mod.slug, mod.name, mod.description, mod.version, mod.icon || "box", mod.menuOrder || 0]
      );
    }
  } catch {
    // Banco pode não estar pronto
  }

  logger.info(`${loaded.length} módulo(s) carregado(s)`);
  return loaded;
}
