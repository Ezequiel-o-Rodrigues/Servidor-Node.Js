import { ModuleDefinition } from "../../module-loader";
import router from "./clientes.routes";

export function register(): ModuleDefinition {
  return {
    slug: "clientes",
    name: "Clientes",
    description: "Gestão de clientes, contatos e endereços",
    version: "1.0.0",
    icon: "users",
    menuOrder: 2,
    router,
  };
}
