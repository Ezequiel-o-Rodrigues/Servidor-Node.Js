import { ModuleDefinition } from "../../module-loader";
import router from "./auth.routes";

export function register(): ModuleDefinition {
  return {
    slug: "auth",
    name: "Autenticação",
    description: "Login, registro e gestão de sessões",
    version: "1.0.0",
    icon: "shield",
    menuOrder: 0,
    router,
  };
}
