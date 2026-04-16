# Production Deploy Runbook — CybaWorld MMORPG

Target host: **Windows 10/11** with Docker Desktop.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Windows | 10 22H2 / 11 |
| RAM | 8 GB (16 GB recommended) |
| Docker Desktop | 4.x with WSL 2 backend |
| Domain name | A-record pointed at host public IP |
| Ports 80 + 443 | Open / forwarded on firewall & router |

---

## 1. Install Docker Desktop

1. Download from <https://www.docker.com/products/docker-desktop/>.
2. Run the installer — ensure **WSL 2 backend** is selected.
3. Restart Windows when prompted.
4. Open PowerShell and verify:

```powershell
docker --version
docker compose version
```

5. In Docker Desktop → Settings → Resources, allocate at least **4 GB RAM** and **2 CPUs** to the WSL 2 VM.

---

## 2. Clone the Repository

```powershell
git clone https://github.com/<org>/MMORPG_Design_Documents.git
cd MMORPG_Design_Documents
```

---

## 3. Configure DNS

Point your domain (e.g. `play.cybaworld.com`) to the host's public IP address with an **A record** at your DNS provider.

Caddy will automatically obtain a Let's Encrypt TLS certificate once DNS propagates (typically < 5 minutes).

---

## 4. Create the Production Environment File

```powershell
copy infra\env\.env.prod.example infra\env\.env.prod
```

Open `infra\env\.env.prod` in a text editor and fill in **real values**:

- `DOMAIN` — your domain, e.g. `play.cybaworld.com`
- `POSTGRES_PASSWORD` — a strong random password (≥ 32 chars)
- `JWT_SECRET` — a random 64-character string

> **Never commit `.env.prod` to version control.**

---

## 5. Build and Start the Stack

From the repository root:

```powershell
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build
```

First build will take several minutes. Subsequent starts are faster.

---

## 6. Verify Services

```powershell
docker compose -f infra/compose/docker-compose.prod.yml ps
```

All services should show **healthy** status. Quick smoke tests:

```powershell
# API health
curl https://play.cybaworld.com/api/health

# WebSocket (upgrade should return 101)
curl -I -H "Connection: Upgrade" -H "Upgrade: websocket" https://play.cybaworld.com/ws

# Frontend
curl -s -o NUL -w "%{http_code}" https://play.cybaworld.com/
```

---

## 7. TLS Certificate Automation

Caddy handles certificate issuance and renewal automatically:

- Certificates are stored in the `cybaworld_prod_caddy_data` Docker volume.
- Renewal happens ~30 days before expiry — no cron jobs needed.
- If the certificate fails to issue, check that ports 80 and 443 are accessible from the internet and DNS has propagated.

To inspect current certificate status:

```powershell
docker exec cybaworld-prod-caddy caddy list-modules
docker logs cybaworld-prod-caddy 2>&1 | findstr "certificate"
```

---

## 8. Viewing Logs

```powershell
# All services
docker compose -f infra/compose/docker-compose.prod.yml logs -f

# Single service
docker compose -f infra/compose/docker-compose.prod.yml logs -f server

# Worker (tick scheduler)
docker compose -f infra/compose/docker-compose.prod.yml logs -f worker
```

Log rotation is configured (10 MB × 3–5 files per container).

---

## 9. Updating to a New Version

```powershell
git pull origin main
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build
```

For zero-downtime considerations, update one service at a time:

```powershell
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build --no-deps server
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build --no-deps worker
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build --no-deps web
```

---

## 10. Backup & Restore

### PostgreSQL Backup

```powershell
docker exec cybaworld-prod-postgres pg_dump -U cybaworld cybaworld > backup_%date:~-4%-%date:~4,2%-%date:~7,2%.sql
```

### PostgreSQL Restore

```powershell
docker exec -i cybaworld-prod-postgres psql -U cybaworld cybaworld < backup_2026-04-16.sql
```

### Volume Backup (full)

```powershell
docker run --rm -v cybaworld_prod_postgres_data:/data -v %cd%:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
```

---

## 11. Stopping the Stack

```powershell
docker compose -f infra/compose/docker-compose.prod.yml down
```

> **Data is preserved** in named volumes. To remove everything including data:
> `docker compose -f infra/compose/docker-compose.prod.yml down -v`

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Caddy logs `tls.obtain` error | Port 80/443 blocked or DNS not pointed | Open ports, verify A record |
| Server unhealthy | DB not ready or bad env vars | Check `docker logs cybaworld-prod-server` |
| Worker exits immediately | Build error in `dist/worker.js` | Rebuild: `docker compose … up -d --build worker` |
| `ECONNREFUSED` on Redis/Postgres | Service not on same network | Verify `networks:` in compose |
| Out of disk | Log rotation or volume growth | Prune: `docker system prune -f` |
