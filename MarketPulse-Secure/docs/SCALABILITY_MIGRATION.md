# MarketPulse Scalability Migration Path

**Version:** 2.1
**Purpose:** Document migration from free-tier to paid infrastructure
**Risk Addressed:** Free-tier limitations causing performance/availability issues

---

## 1. Current Architecture (Free Tier)

### Resource Constraints

| Resource | Free Tier Limit | Usage |
|----------|-----------------|-------|
| RAM | 1GB | ~768MB allocated |
| CPU | 1 vCPU | Variable |
| Storage | 5-10GB | ~500MB used |
| Bandwidth | Limited | ~50MB/day |
| Uptime | No SLA | Best effort |

### Limitations

- **No redundancy** - Single point of failure
- **Cold starts** - Container may be evicted
- **Rate limits** - API calls throttled
- **No autoscaling** - Fixed resources
- **No backups** - Manual only

---

## 2. Scaling Triggers

### When to Migrate

| Indicator | Threshold | Action |
|-----------|-----------|--------|
| Memory usage | > 90% sustained | Upgrade RAM |
| Workflow failures | > 5% rate | Investigate/upgrade |
| Response time | > 30s average | Upgrade CPU |
| User complaints | Any reliability issues | Consider paid tier |
| API rate limits | Hitting limits daily | Upgrade API plan |

### Monitoring Commands

```bash
# Check container resource usage
docker stats marketpulse-n8n --no-stream

# Check workflow execution history
docker compose logs n8n | grep -i "error\|failed"

# Check memory pressure
docker compose exec n8n cat /sys/fs/cgroup/memory/memory.usage_in_bytes
```

---

## 3. Migration Tiers

### Tier 1: Enhanced Free ($0/month)

**When:** Hitting soft limits occasionally

**Actions:**
- Optimize workflow (reduce API calls)
- Implement caching for Fear & Greed data
- Reduce batch sizes
- Schedule during off-peak hours

```yaml
# Optimized scheduling - off-peak hours
schedule:
  - hours: 5  # 5 AM UTC (less traffic)
```

---

### Tier 2: Budget VPS ($5-10/month)

**When:** Consistent performance issues

**Providers:**
- DigitalOcean Droplet ($6/mo - 1GB RAM, 1 vCPU)
- Vultr Cloud Compute ($6/mo - 1GB RAM, 1 vCPU)
- Hetzner Cloud CX11 (€3.29/mo - 2GB RAM, 1 vCPU)
- Oracle Cloud Free Tier (2 AMD instances free forever)

**Migration Steps:**

```bash
# 1. Create encrypted backup
./scripts/backup-encrypted.sh

# 2. Transfer to new server
scp ./backups/marketpulse-backup-*.tar.gz.enc user@new-server:/opt/marketpulse/backups/
scp ./secrets/backup_encryption_key user@new-server:/opt/marketpulse/secrets/

# 3. On new server: Clone repository
git clone <repo> /opt/marketpulse
cd /opt/marketpulse

# 4. Run setup
./setup.sh

# 5. Restore backup
./scripts/restore-encrypted.sh /opt/marketpulse/backups/<backup-file>.tar.gz.enc

# 6. Update DNS
# Point domain to new server IP

# 7. Start services
docker compose up -d
```

**Updated docker-compose.yml for Tier 2:**

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1536M  # Increased from 768M
    reservations:
      cpus: '0.5'
      memory: 1024M  # Increased from 512M
```

---

### Tier 3: Production VPS ($20-50/month)

**When:** Growing user base, reliability critical

**Providers:**
- DigitalOcean ($24/mo - 4GB RAM, 2 vCPU)
- AWS Lightsail ($20/mo - 4GB RAM, 2 vCPU)
- Linode ($24/mo - 4GB RAM, 2 vCPU)

**Enhancements:**
- Enable automated backups (provider-level)
- Add monitoring (Uptime Robot, Healthchecks.io)
- Configure alerting
- Enable firewall rules

**docker-compose.yml for Tier 3:**

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 3072M
    reservations:
      cpus: '1.0'
      memory: 2048M
```

---

### Tier 4: High Availability ($100+/month)

**When:** Mission-critical, SLA required

**Architecture:**

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │  (Cloudflare)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  n8n-1   │  │  n8n-2   │  │  n8n-3   │
        │ (Primary)│  │(Standby) │  │(Standby) │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                    ┌───────▼───────┐
                    │   PostgreSQL  │
                    │   (Managed)   │
                    └───────────────┘
```

**Components:**
- Managed PostgreSQL (DigitalOcean: $15/mo, AWS RDS: $25/mo)
- Multiple n8n instances with queue mode
- Load balancer (Cloudflare free, or AWS ALB)
- Redis for queue (managed: $10/mo)

**docker-compose.yml for HA:**

```yaml
services:
  n8n:
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=your-managed-db.com
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD_FILE=/run/secrets/db_password
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=your-redis.com
```

---

## 4. API Scaling

### LLM API Migration Path

| Tier | Provider | Cost | Rate Limit |
|------|----------|------|------------|
| Free | Groq Free | $0 | 30 req/min |
| Basic | Groq Paid | $0.05/1M tokens | 100 req/min |
| Pro | OpenAI | $0.50/1M tokens | 500 req/min |
| Enterprise | Azure OpenAI | Custom | Custom |

### Telegram Bot Limits

| Tier | Messages/sec | Groups |
|------|--------------|--------|
| Normal | 1/sec per chat | 20 groups |
| Bot API Server | 100/sec | Unlimited |

To self-host Telegram Bot API:
```bash
docker run -d \
  -p 8081:8081 \
  -e TELEGRAM_API_ID=<id> \
  -e TELEGRAM_API_HASH=<hash> \
  aiogram/telegram-bot-api
```

---

## 5. Cost Projection

| Tier | Monthly Cost | Suitable For |
|------|--------------|--------------|
| Free | $0 | Personal use, testing |
| Budget | $5-10 | Small group (<100 users) |
| Production | $20-50 | Growing audience (100-1000) |
| HA | $100-200 | Business critical (1000+) |
| Enterprise | $500+ | Commercial product |

---

## 6. Migration Checklist

### Before Migration

- [ ] Create encrypted backup
- [ ] Export all credentials from n8n
- [ ] Document current workflow configurations
- [ ] Test backup restoration on staging
- [ ] Plan maintenance window
- [ ] Notify users of potential downtime

### During Migration

- [ ] Stop old instance
- [ ] Final backup
- [ ] Deploy new infrastructure
- [ ] Restore data
- [ ] Update DNS
- [ ] Verify SSL certificates
- [ ] Test workflow execution

### After Migration

- [ ] Monitor for 24 hours
- [ ] Verify all alerts working
- [ ] Confirm backup jobs running
- [ ] Update documentation
- [ ] Decommission old infrastructure
- [ ] Review security settings

---

## 7. Rollback Plan

If migration fails:

1. **Revert DNS** to old server IP (TTL permitting)
2. **Restart old instance** if still available
3. **Restore from backup** on original server
4. **Investigate** root cause before retry

```bash
# Emergency rollback
docker compose down
./scripts/restore-encrypted.sh <last-known-good-backup>
docker compose up -d
```

---

## 8. Future Considerations

### Kubernetes Migration (Advanced)

For maximum scalability, consider Kubernetes:

```yaml
# k8s deployment snippet
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
spec:
  replicas: 3
  selector:
    matchLabels:
      app: n8n
  template:
    spec:
      containers:
      - name: n8n
        image: n8nio/n8n:1.70.3
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Serverless Option

For burst workloads, consider:
- AWS Lambda + Step Functions
- Google Cloud Functions
- Azure Functions

Note: Requires workflow re-architecture.
