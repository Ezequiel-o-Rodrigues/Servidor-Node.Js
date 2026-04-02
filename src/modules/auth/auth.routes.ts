import { Router } from "express";
import { z } from "zod";
import * as controller from "./auth.controller";
import * as sshController from "./ssh.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";

const router = Router();

// Login com senha
const loginSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});
router.post("/login", validate(loginSchema), controller.login);
router.post("/logout", controller.logout);
router.get("/profile", authenticate, controller.profile);
router.get("/modules", authenticate, controller.myModules);

// SSH Key Auth - Challenge-Response
const challengeSchema = z.object({
  username: z.string().min(1),
});
const verifySchema = z.object({
  username: z.string().min(1),
  challenge: z.string().min(1),
  signature: z.string().min(1),
});
router.post("/ssh/challenge", validate(challengeSchema), sshController.requestChallenge);
router.post("/ssh/verify", validate(verifySchema), sshController.verifyChallengeResponse);

// SSH Key Management (autenticado)
const addKeySchema = z.object({
  name: z.string().min(1, "Nome da chave é obrigatório"),
  publicKey: z.string().min(1, "Chave pública é obrigatória"),
});
router.get("/ssh/keys", authenticate, sshController.listKeys);
router.post("/ssh/keys", authenticate, validate(addKeySchema), sshController.addKey);
router.delete("/ssh/keys/:keyId", authenticate, sshController.removeKey);

export default router;
