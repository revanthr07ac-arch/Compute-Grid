FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/compute/package*.json ./packages/compute/
COPY apps/api/package*.json ./apps/api/
COPY apps/worker/package*.json ./apps/worker/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build:shared
RUN npm run build:web

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
