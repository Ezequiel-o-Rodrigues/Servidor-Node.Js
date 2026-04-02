import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password } = req.body;
    const result = await authService.loginUser(username, password);

    // Set cookie for frontend
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie("token");
  res.json({ message: "Logout realizado com sucesso" });
}

export async function profile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getProfile(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function myModules(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await authService.getUserRole(req.user!.userId);
    let modules;

    if (role === "super_admin") {
      // Super admin vê todos os módulos
      const { query: dbQuery } = require("../../config/database");
      const result = await dbQuery(
        "SELECT slug, name, description, icon, menu_order, true as can_read, true as can_write, true as can_delete, true as can_admin FROM modules WHERE enabled = true ORDER BY menu_order, name"
      );
      modules = result.rows;
    } else {
      modules = await authService.getUserModules(req.user!.userId);
    }

    res.json(modules);
  } catch (err) {
    next(err);
  }
}
