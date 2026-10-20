FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/

RUN npm install

COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker

RUN npm run build:shared
RUN npm run build:worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist

CMD ["node", "packages/worker/dist/index.js", "start"]
