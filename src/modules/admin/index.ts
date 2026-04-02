import { ModuleDefinition } from "../../module-loader";
import router from "./admin.routes";

export function register(): ModuleDefinition {
  return {
    slug: "admin",
    name: "Administração",
    description: "Painel administrativo e gestão do sistema",
    version: "1.0.0",
    icon: "settings",
    menuOrder: 1,
    router,
  };
}
