#!/bin/sh
set -e

echo "===================================================="
echo "⚡ Starting ComputeGrid API Service..."
echo "===================================================="

# Determine Prisma schema file based on DATABASE_URL
if echo "$DATABASE_URL" | grep -q "^postgres"; then
  SCHEMA_FILE="./apps/api/prisma/schema.postgres.prisma"
  echo "[Entrypoint] Detected PostgreSQL database connection."
else
  SCHEMA_FILE="./apps/api/prisma/schema.prisma"
  echo "[Entrypoint] Detected SQLite database connection."
fi

echo "[Entrypoint] Applying database schema migrations ($SCHEMA_FILE)..."
npx prisma db push --schema="$SCHEMA_FILE" --accept-data-loss=false

if [ "$AUTO_SEED" = "true" ] || [ "$NODE_ENV" != "production" ]; then
  echo "[Entrypoint] Running idempotent database seed..."
  npx tsx ./apps/api/prisma/seed.ts || echo "[Entrypoint] Seeding completed or skipped."
fi

echo "[Entrypoint] Launching API server daemon..."
exec "$@"
