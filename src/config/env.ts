import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(10, "JWT_SECRET precisa ter pelo menos 10 caracteres"),
});

export const env = envSchema.parse(process.env);
