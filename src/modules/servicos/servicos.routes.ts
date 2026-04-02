import { Router } from "express";
import { z } from "zod";
import * as controller from "./servicos.controller";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";

const router = Router();
router.use(authenticate, authorize("admin", "super_admin"));

const createSchema = z.object({
  nome: z.string().min(1),
  cliente_id: z.number().optional(),
  descricao: z.string().optional(),
  tipo: z.string().optional(),
  url_site: z.string().optional(),
  url_admin: z.string().optional(),
  url_banco: z.string().optional(),
  ip_servidor: z.string().optional(),
  porta: z.number().optional(),
  banco_nome: z.string().optional(),
  banco_usuario: z.string().optional(),
  credenciais: z.string().optional(),
  valor_mensal: z.number().optional(),
  data_inicio: z.string().optional(),
  data_vencimento: z.string().optional(),
  observacoes: z.string().optional(),
});

const linkSchema = z.object({
  titulo: z.string().min(1),
  url: z.string().min(1),
  tipo: z.string().optional(),
});

router.get("/stats", controller.stats);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validate(createSchema), controller.create);
router.put("/:id", controller.update);
router.patch("/:id/toggle", controller.toggle);
router.delete("/:id", controller.remove);

// Links
router.post("/:id/links", validate(linkSchema), controller.addLink);
router.delete("/links/:linkId", controller.removeLink);

export default router;
