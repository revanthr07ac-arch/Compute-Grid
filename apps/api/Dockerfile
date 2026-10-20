FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/compute/package*.json ./packages/compute/
COPY apps/api/package*.json ./apps/api/
COPY apps/worker/package*.json ./apps/worker/
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copy source trees
COPY packages/shared ./packages/shared
COPY packages/compute ./packages/compute
COPY apps/api ./apps/api

# Build shared, compute, and API with postgres prisma client
RUN npm run build:shared
RUN npm run build:compute
RUN npx prisma generate --schema=./apps/api/prisma/schema.postgres.prisma
RUN npm run build:api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/compute/package*.json ./packages/compute/
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/compute/dist ./packages/compute/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN chmod +x ./apps/api/docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/index.js"]
