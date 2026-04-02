import { ModuleDefinition } from "../../module-loader";
import router from "./servicos.routes";

export function register(): ModuleDefinition {
  return {
    slug: "servicos",
    name: "Serviços",
    description: "Gestão dos serviços prestados aos clientes",
    version: "1.0.0",
    icon: "box",
    menuOrder: 3,
    router,
  };
}
