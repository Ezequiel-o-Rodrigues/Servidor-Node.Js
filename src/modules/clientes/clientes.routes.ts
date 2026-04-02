import { Router } from "express";
import { z } from "zod";
import * as controller from "./clientes.controller";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";

const router = Router();
router.use(authenticate, authorize("admin", "super_admin"));

const createSchema = z.object({
  nome: z.string().min(1),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
});

router.get("/stats", controller.stats);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validate(createSchema), controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
