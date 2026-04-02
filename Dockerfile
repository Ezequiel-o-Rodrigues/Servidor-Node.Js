# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Production stage
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssh-keygen && addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Copiar frontend assets (HTML, CSS, JS)
COPY src/frontend ./dist/frontend
COPY src/modules/auth/frontend ./dist/modules/auth/frontend
COPY src/modules/admin/frontend ./dist/modules/admin/frontend
COPY src/modules/clientes/frontend ./dist/modules/clientes/frontend
COPY src/modules/servicos/frontend ./dist/modules/servicos/frontend
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
