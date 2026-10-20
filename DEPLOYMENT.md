# ComputeGrid Production Deployment Manual

This guide provides end-to-end instructions for deploying **ComputeGrid** to production using Docker Compose, PostgreSQL 16, Redis 7, MinIO (or AWS S3), Nginx TLS Gateway, and scalable worker agents.

---

## 1. Architecture & Component Topology

```
                              Internet / Clients
                                      │
                         [Ports: 80, 443 (TLS/WSS)]
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       Nginx TLS Gateway & Reverse Proxy          │
             │   - Modern TLS 1.2/1.3, HSTS, Rate Limiting      │
             │   - WebSocket Upgrades (/socket.io/)             │
             │   - Static Asset Caching (/assets/)              │
             └────────┬────────────────────────────────┬────────┘
                      │ (Proxy :80)                    │ (Proxy :4000)
                      ▼                                ▼
         ┌─────────────────────────┐      ┌─────────────────────────┐
         │     Web Frontend        │      │    Backend API &        │
         │  (Vite React SPA / Nginx│      │  Task Scheduler Daemon  │
         │   Container)            │      │  (Node.js 20 Express)   │
         └─────────────────────────┘      └────────────┬────────────┘
                                                       │
                      ┌────────────────────────────────┼────────────────────────────────┐
                      │                                │                                │
                      ▼                                ▼                                ▼
         ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
         │       PostgreSQL 16     │      │        Redis 7          │      │     MinIO / AWS S3      │
         │  - Relational Database  │      │  - Task Queue (BullMQ)  │      │  - Distributed Artifact │
         │  - Named Volume Data    │      │  - Append-Only File AOF │      │    Object Storage       │
         └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                       ▲
                                                       │ (Task Claims, Heartbeats, Submissions)
                               ┌───────────────────────┴───────────────────────┐
                               │                                               │
                               ▼                                               ▼
                  ┌─────────────────────────┐                     ┌─────────────────────────┐
                  │ Container Worker Alpha  │                     │ Container Worker Beta   │
                  │  (Autonomous Executor)  │                     │  (Autonomous Executor)  │
                  └─────────────────────────┘                     └─────────────────────────┘
                               ▲                                               ▲
                               │                                               │
                               └───────── Additional Remote Workers ───────────┘
                                         (Bare-metal / GPU Nodes)
```

---

## 2. Infrastructure Requirements & Recommendations

### Recommended Hosting Providers
- **DigitalOcean**: Droplet (Ubuntu 24.04 LTS, 4GB RAM, 2 vCPU, 50GB SSD).
- **Hetzner Cloud**: CX32 / CPX31 (Ubuntu 24.04 LTS, 8GB RAM, 4 vCPU).
- **AWS EC2**: `t3.medium` or `t3.large` instance with Ubuntu 24.04 LTS and EBS gp3 storage.
- **Google Cloud (GCP)**: `e2-standard-2` (2 vCPU, 8GB RAM).

### Minimum Hardware Sizing
| Resource | Minimum | Recommended Production |
| :--- | :--- | :--- |
| **CPU** | 2 vCPU cores | 4+ vCPU cores |
| **RAM** | 4 GB | 8 GB+ |
| **Disk** | 40 GB NVMe / SSD | 100 GB+ SSD |
| **Network** | 1 Gbps | 1 Gbps+ |

---

## 3. Pre-Requisites & Manual Cloud Setup (External Credentials)

Before starting the automated container deployment, complete these external steps:

### 1. DNS Record Setup (Domain Provider)
Point your domain or subdomain to your server's public IP address:
- **Type**: `A`
- **Name**: `computegrid` (or `@` for root)
- **Value**: `<YOUR_SERVER_PUBLIC_IPV4>`
- **TTL**: 300 seconds

### 2. Cloud Security Group / Firewall Rules
Ensure the following ports are open in your cloud provider's firewall:
- **Port 22 (SSH)**: Administrative access (restrict to your IP if possible).
- **Port 80 (HTTP)**: Required for ACME HTTP-01 Let's Encrypt challenges and HTTPS redirection.
- **Port 443 (HTTPS)**: Primary user traffic, WebSocket streaming, and worker agent connections.

> [!NOTE]
> Ports `5432` (Postgres), `6379` (Redis), `4000` (API), and `9000` (MinIO) are **strictly isolated inside the internal Docker bridge network** and must **NOT** be exposed publicly.

---

## 4. Host OS Preparation (Ubuntu 22.04 / 24.04 LTS)

SSH into your server and run the following commands to install Docker Engine and Compose:

```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential utilities
sudo apt install -y curl wget git ufw openssl ca-certificates gnupg

# 3. Configure local firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Install official Docker Engine & Docker Compose Plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable and start Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```
*(Log out and log back in for docker group membership to take effect).*

---

## 5. Clone Repository & Configure Environment

```bash
# Clone the repository
git clone https://github.com/revanthr07ac-arch/Compute-Grid.git /opt/computegrid
cd /opt/computegrid

# Copy the production environment configuration template
cp .env.production.example .env
```

### Generating Cryptographic Secrets
Generate unique production secrets using `openssl rand -hex 32` and populate `.env`:

```bash
# Generate keys
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_PASSWORD=$(openssl rand -hex 24)
WORKER_TOKEN="cg_enroll_$(openssl rand -hex 16)"

echo "Generated JWT Secret: $JWT_SECRET"
echo "Generated DB Password: $POSTGRES_PASSWORD"
echo "Generated MinIO Password: $MINIO_PASSWORD"
echo "Generated Worker Token: $WORKER_TOKEN"
```

Edit `.env` (`nano .env`) and set:
```ini
NODE_ENV=production
DOMAIN_NAME=computegrid.yourdomain.com
CORS_ORIGIN=https://computegrid.yourdomain.com

JWT_SECRET=<YOUR_GENERATED_JWT_SECRET>
POSTGRES_USER=computegrid_user
POSTGRES_PASSWORD=<YOUR_GENERATED_DB_PASSWORD>
POSTGRES_DB=computegrid_prod

MINIO_ROOT_USER=computegrid_minio_admin
MINIO_ROOT_PASSWORD=<YOUR_GENERATED_MINIO_PASSWORD>
S3_ACCESS_KEY=computegrid_minio_admin
S3_SECRET_KEY=<YOUR_GENERATED_MINIO_PASSWORD>

WORKER_ENROLLMENT_TOKEN=<YOUR_GENERATED_WORKER_TOKEN>
LETSENCRYPT_EMAIL=admin@yourdomain.com
AUTO_SEED=true
```

---

## 6. TLS / SSL Certificate Provisioning

ComputeGrid supports both **Automated Let's Encrypt (Certbot)** and **Self-Signed Certificates (for testing/staging)**.

### Option A: Let's Encrypt (Recommended for Production Domains)
Make sure your domain's DNS `A` record points to your server IP, then run:

```bash
# Install Certbot standalone
sudo apt install -y certbot

# Issue certificate (temporarily stop any process on port 80)
sudo certbot certonly --standalone \
  -d computegrid.yourdomain.com \
  --agree-tos \
  -m admin@yourdomain.com \
  --non-interactive

# Copy certificates into the Nginx configuration directory
mkdir -p infra/nginx/certs
sudo cp /etc/letsencrypt/live/computegrid.yourdomain.com/fullchain.pem infra/nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/computegrid.yourdomain.com/privkey.pem infra/nginx/certs/privkey.pem
sudo chown -R $USER:$USER infra/nginx/certs
```

### Option B: Self-Signed Certificate (For Staging / Initial Deployment)
If you are testing before DNS cutover or using an internal IP:

```bash
chmod +x infra/nginx/generate-self-signed-ssl.sh
./infra/nginx/generate-self-signed-ssl.sh
```

---

## 7. Build & Launch the ComputeGrid Production Stack

Build the containers and launch the entire multi-service stack in detached mode:

```bash
# 1. Build and start all services
docker compose build --pull
docker compose up -d

# 2. Monitor startup progression
docker compose ps
```

### What Happens During Boot:
1. `postgres` starts, initializes the database, and begins healthchecks (`pg_isready`).
2. `redis` starts with Append-Only File (`AOF`) persistence.
3. `minio` boots and `minio-init` automatically creates the `computegrid-artifacts` bucket.
4. `api` waits for PostgreSQL and Redis to be healthy, executes `docker-entrypoint.sh`, automatically runs Prisma schema migrations (`npx prisma db push --schema=./apps/api/prisma/schema.postgres.prisma`), executes the idempotent seed script, and starts the API daemon.
5. `web` builds the production React application with Vite, serves it with Nginx, and proxies `/api/` and `/socket.io/`.
6. `reverse-proxy` terminates TLS on port 443, enforces security headers, and routes traffic.
7. `worker-alpha` and `worker-beta` enroll with the API server, report metrics, and start polling the distributed queue.

---

## 8. Verifying Service Health & Logs

Check that all containers show `Up (healthy)`:

```bash
docker compose ps
```

Expected output:
```
NAME                         IMAGE               COMMAND                  SERVICE             STATUS
computegrid-gateway          nginx:alpine        "/docker-entrypoint.…"   reverse-proxy       Up (healthy)
computegrid-api              computegrid-api     "/app/apps/api/docke…"   api                 Up (healthy)
computegrid-web              computegrid-web     "/docker-entrypoint.…"   web                 Up (healthy)
computegrid-postgres         postgres:16-alpine  "docker-entrypoint.s…"   postgres            Up (healthy)
computegrid-redis            redis:7-alpine      "docker-entrypoint.s…"   redis               Up (healthy)
computegrid-minio            minio/minio:latest  "/usr/bin/docker-ent…"   minio               Up (healthy)
computegrid-worker-alpha     computegrid-worker  "docker-entrypoint.s…"   worker-alpha        Up
computegrid-worker-beta      computegrid-worker  "docker-entrypoint.s…"   worker-beta         Up
```

### Viewing Logs
```bash
# View API server logs and migration output
docker compose logs -f api

# View worker activity
docker compose logs -f worker-alpha worker-beta

# View gateway access logs
docker compose logs -f reverse-proxy
```

### Testing Endpoints via Terminal
```bash
# Health live probe
curl -k https://localhost/api/v1/health/live

# Health ready probe (verifies database connectivity)
curl -k https://localhost/api/v1/health/ready
```

---

## 9. Default Administrator & Seed Accounts

When `AUTO_SEED=true` is enabled, the system automatically provisions:

- **Admin Account**:
  - **Email**: `admin@computegrid.io`
  - **Password**: `AdminGrid123!`
  - **Role**: `ADMIN` (Access to Admin Dashboard, Worker Fleet Management, System Audit Logs)
- **Demo User Account**:
  - **Email**: `demo@computegrid.io`
  - **Password**: `DemoGrid123!`
  - **Role**: `USER`
- **Initial Worker Enrollment Token**:
  - `cg_enroll_demo_initial_token_12345` (or the token specified in `WORKER_ENROLLMENT_TOKEN`)

> [!IMPORTANT]
> Immediately upon logging in for the first time, navigate to the **Profile** page and change the default passwords for both accounts!

---

## 10. Worker Agent Fleet Scaling

### Scaling Local Container Workers
You can scale workers horizontally on the same host with a single command:

```bash
# Scale to 4 worker instances
docker compose up -d --scale worker-alpha=4
```

### Connecting External Workers (Bare-Metal / Remote Cloud / GPU Nodes)
To connect any remote machine (developer laptop, office workstation, or dedicated GPU server) to your cluster:

```bash
# 1. On the remote machine (requires Node.js 20+)
npx @computegrid/worker start \
  --server https://computegrid.yourdomain.com \
  --token <YOUR_ENROLLMENT_TOKEN> \
  --name "GPU-Worker-Node-01" \
  --concurrency 8
```
The remote worker will automatically register, store credentials in a local configuration file, report CPU/memory telemetry, and begin picking up chunked tasks from your jobs.

---

## 11. Automated Maintenance, Backups & Recovery

### Automated PostgreSQL Backup Cron
Create an automated nightly database backup script:

```bash
sudo mkdir -p /opt/backups/computegrid

cat << 'EOF' | sudo tee /opt/computegrid/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/backups/computegrid"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec computegrid-postgres pg_dump -U computegrid_user computegrid_prod | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
# Keep only last 14 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
echo "[$(date)] Backup completed: db_$DATE.sql.gz"
EOF

sudo chmod +x /opt/computegrid/backup.sh
```

Add to cron:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/computegrid/backup.sh >> /var/log/computegrid_backup.log 2>&1") | crontab -
```

### Restoring from Backup
```bash
gunzip < /opt/backups/computegrid/db_YYYYMMDD_HHMMSS.sql.gz | docker exec -i computegrid-postgres psql -U computegrid_user -d computegrid_prod
```

### Automatic Let's Encrypt Certificate Renewal
Add a bi-monthly cron job to renew certificates and reload Nginx:

```bash
cat << 'EOF' | sudo tee /opt/computegrid/renew-certs.sh
#!/bin/bash
certbot renew --quiet --deploy-hook "
  cp /etc/letsencrypt/live/computegrid.yourdomain.com/fullchain.pem /opt/computegrid/infra/nginx/certs/fullchain.pem
  cp /etc/letsencrypt/live/computegrid.yourdomain.com/privkey.pem /opt/computegrid/infra/nginx/certs/privkey.pem
  docker exec computegrid-gateway nginx -s reload
"
EOF

sudo chmod +x /opt/computegrid/renew-certs.sh
(crontab -l 2>/dev/null; echo "0 3 1,15 * * /opt/computegrid/renew-certs.sh") | crontab -
```

---

## 12. Zero-Downtime Rolling Update Procedure

To deploy new code changes without interrupting ongoing compute tasks:

```bash
cd /opt/computegrid

# 1. Pull the latest commits from GitHub
git pull origin main

# 2. Build the new container images
docker compose build --pull

# 3. Apply schema migrations & restart API
docker compose up -d --no-deps api

# 4. Restart web frontend and workers
docker compose up -d --no-deps web reverse-proxy worker-alpha worker-beta

# 5. Clean up old untagged Docker images
docker image prune -f
```
