FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copy source trees
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared and API
RUN npm run build:shared
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build:api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
