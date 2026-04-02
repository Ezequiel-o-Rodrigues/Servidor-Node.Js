import { Router } from "express";
import { z } from "zod";
import * as controller from "./auth.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

router.post("/login", validate(loginSchema), controller.login);
router.post("/logout", controller.logout);
router.get("/profile", authenticate, controller.profile);
router.get("/modules", authenticate, controller.myModules);

export default router;
