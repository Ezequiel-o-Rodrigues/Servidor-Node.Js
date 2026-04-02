import { Router } from "express";
import { z } from "zod";
import * as controller from "./admin.controller";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";

const router = Router();

// Todas as rotas admin requerem autenticação + role admin ou super_admin
router.use(authenticate, authorize("admin", "super_admin"));

// Stats
router.get("/stats", controller.getStats);

// Users CRUD
const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().optional(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.get("/users", controller.listUsers);
router.get("/users/:id", controller.getUser);
router.post("/users", validate(createUserSchema), controller.createUser);
router.put("/users/:id", validate(updateUserSchema), controller.updateUser);
router.delete("/users/:id", controller.deleteUser);

// Modules
router.get("/modules", controller.listModules);
router.patch("/modules/:slug", controller.toggleModule);

// Permissions
const permissionSchema = z.object({
  canRead: z.boolean().optional(),
  canWrite: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canAdmin: z.boolean().optional(),
});

router.put(
  "/users/:userId/permissions/:moduleSlug",
  validate(permissionSchema),
  controller.setPermission
);

// Terminal — APENAS super_admin
router.post("/terminal", authorize("super_admin"), controller.executeCommand);

export default router;
