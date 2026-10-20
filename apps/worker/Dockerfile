FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/compute/package*.json ./packages/compute/
COPY apps/worker/package*.json ./apps/worker/

RUN npm install

COPY packages/shared ./packages/shared
COPY packages/compute ./packages/compute
COPY apps/worker ./apps/worker

RUN npm run build:shared
RUN npm run build:compute
RUN npm run build:worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/compute/package*.json ./packages/compute/
COPY apps/worker/package*.json ./apps/worker/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/compute/dist ./packages/compute/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/index.js", "start"]
