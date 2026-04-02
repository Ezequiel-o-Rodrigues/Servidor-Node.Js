import { Request, Response, NextFunction } from "express";
import * as adminService from "./admin.service";

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// Users
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.listUsers()); } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.getUser(parseInt(paramStr(req.params.id)))); } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await adminService.createUser(req.body)); } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.updateUser(parseInt(paramStr(req.params.id)), req.body)); } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.deleteUser(parseInt(paramStr(req.params.id)))); } catch (err) { next(err); }
}

// Modules
export async function listModules(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.listModules()); } catch (err) { next(err); }
}

export async function toggleModule(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await adminService.toggleModule(paramStr(req.params.slug), req.body.enabled));
  } catch (err) { next(err); }
}

// Permissions
export async function setPermission(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await adminService.setUserPermission(
      parseInt(paramStr(req.params.userId)),
      paramStr(req.params.moduleSlug),
      req.body
    ));
  } catch (err) { next(err); }
}

// Stats
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.getSystemStats()); } catch (err) { next(err); }
}

// Terminal
export async function executeCommand(req: Request, res: Response, next: NextFunction) {
  try {
    const { command } = req.body;
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Comando é obrigatório" });
    }

    // Bloquear comandos destrutivos
    const blocked = ["rm -rf /", "mkfs", "dd if=", ":(){:|:&};:", "shutdown", "reboot", "init 0", "init 6"];
    const lowerCmd = command.toLowerCase().trim();
    for (const b of blocked) {
      if (lowerCmd.includes(b)) {
        return res.json({ stdout: "", stderr: `Comando bloqueado por segurança: ${b}`, code: 1 });
      }
    }

    const { execSync } = require("child_process");
    try {
      const stdout = execSync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        encoding: "utf-8",
        cwd: "/app",
        env: { ...process.env, TERM: "dumb" },
      });
      res.json({ stdout: stdout || "(sem saída)", stderr: "", code: 0 });
    } catch (err: any) {
      res.json({
        stdout: err.stdout || "",
        stderr: err.stderr || err.message,
        code: err.status || 1,
      });
    }
  } catch (err) { next(err); }
}
