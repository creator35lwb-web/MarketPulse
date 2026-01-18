# MarketPulse v2.1 - Enhanced Security Edition

AI-powered daily stock market sentiment analysis with enterprise-grade security.

> **Financial Disclaimer:** This tool provides AI-generated sentiment analysis for informational purposes only. It does NOT constitute financial advice. Always consult a qualified financial advisor before making investment decisions.

## What's New in v2.1

This version addresses **all 5 remaining vulnerabilities** and implements **4 recommended security steps** from VerifiMind Trinity validation:

### Vulnerabilities Resolved

| # | Vulnerability | Solution |
|---|--------------|----------|
| 1 | n8n CVE Exposure | Automated Trivy scanning, CVE monitoring protocol |
| 2 | Docker Secrets Access | Environment blocking, access control hardening |
| 3 | Telegram Alert Leakage | Error sanitization, separate admin channel |
| 4 | Input Validation Bypass | Defense-in-depth validation (10+ patterns) |
| 5 | Unencrypted Backups | AES-256-CBC encryption with PBKDF2 |

### Recommended Steps Implemented

| Step | Implementation |
|------|----------------|
| 1. User Disclaimers | Financial disclaimer in every message |
| 2. AI Bias Monitoring | Sentiment tracking and logging |
| 3. Scalability Path | 4-tier migration documentation |
| 4. Secure Telegram | Separate admin channel for errors |

## Security Controls (v2.0 + v2.1)

| Control | Status |
|---------|--------|
| SSL/TLS Encryption | Traefik + Let's Encrypt |
| Authentication | Basic Auth + Session Encryption |
| Docker Version Pinning | n8n:1.70.3 (verified) |
| Secrets Management | Docker Secrets (file-based) |
| Rate Limiting | 100 req/min via Traefik |
| Security Headers | HSTS, CSP, X-Frame-Options |
| Error Handling | Error Trigger + Sanitized Alerts |
| Input Validation | Defense-in-depth (XSS, injection blocking) |
| Container Hardening | Non-root, read-only, caps dropped |
| Resource Limits | 768MB memory, 1 CPU |
| Backup Security | AES-256-CBC encrypted backups |
| CVE Monitoring | Weekly automated scans |

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- Domain name with DNS access
- 1GB+ RAM server

### Installation

```bash
# 1. Clone/download this directory
cd MarketPulse-Secure

# 2. Run setup script
chmod +x setup.sh
./setup.sh

# 3. Configure environment
cp .env.example .env
nano .env  # Edit with your domain, email, and chat IDs

# 4. Configure DNS
# Add A record: your-domain.com -> your-server-ip

# 5. Deploy
docker compose up -d

# 6. Access n8n
# https://your-domain.com
# Username: from .env (N8N_USER)
# Password: from secrets/n8n_password
```

### Configure Credentials in n8n

1. Go to **Settings > Credentials**
2. Add **Groq API** credential with your API key
3. Add **Telegram API** credential with your bot token
4. Import workflow from `workflows/marketpulse-workflow-v2.1-secure.json`
5. Update Telegram chat IDs (user channel AND admin channel)
6. Activate the workflow

## File Structure

```
MarketPulse-Secure/
├── docker-compose.yml           # Main deployment config (v2.1)
├── .env.example                 # Environment template
├── .gitignore                   # Security-focused ignores
├── setup.sh                     # Automated setup script
├── CHANGELOG.md                 # Version history
├── README.md                    # This file
├── SECURITY_ARCHITECTURE.md     # Detailed security docs
│
├── security/                    # NEW in v2.1
│   ├── CVE_MONITORING.md        # Vulnerability scanning guide
│   ├── SECRETS_HARDENING.md     # Secrets access control
│   └── reports/                 # Scan reports (gitignored)
│
├── scripts/                     # NEW in v2.1
│   ├── backup-encrypted.sh      # AES-256 encrypted backups
│   └── restore-encrypted.sh     # Encrypted restore
│
├── docs/
│   └── SCALABILITY_MIGRATION.md # Scaling guide
│
├── traefik/
│   ├── traefik.yml              # Traefik static config
│   ├── acme.json                # SSL certificates (auto-generated)
│   └── dynamic/
│       └── security.yml         # Security middlewares
│
├── workflows/
│   ├── marketpulse-workflow-template.json      # v2.0 workflow
│   └── marketpulse-workflow-v2.1-secure.json   # v2.1 workflow (recommended)
│
├── secrets/                     # Generated secrets (gitignored)
│   ├── n8n_password
│   ├── n8n_encryption_key
│   ├── n8n_jwt_secret
│   └── backup_encryption_key    # NEW in v2.1
│
└── backups/                     # Encrypted backups (gitignored)
```

## Security Operations

### Weekly Vulnerability Scan

```bash
./security/scan-vulnerabilities.sh
```

### Encrypted Backup

```bash
./scripts/backup-encrypted.sh
```

### Restore from Backup

```bash
./scripts/restore-encrypted.sh ./backups/<backup-file>.tar.gz.enc
```

### Rotate Passwords

See `security/SECRETS_HARDENING.md` for rotation protocol.

## Telegram Channel Setup

v2.1 requires **two separate Telegram channels**:

| Channel | Purpose | Environment Variable |
|---------|---------|---------------------|
| User Channel | Daily digest delivery | `TELEGRAM_CHAT_ID` |
| Admin Channel | Error alerts (sanitized) | `TELEGRAM_ADMIN_CHAT_ID` |

**Why separate channels?** Error alerts may contain debugging information. Keeping them in a private admin channel prevents accidental information exposure to end users.

## Troubleshooting

### SSL certificate not working

```bash
# Check Traefik logs
docker compose logs traefik

# Verify DNS is pointing to server
dig your-domain.com
```

### n8n not starting

```bash
# Check container status
docker compose ps

# Check n8n logs
docker compose logs n8n

# Verify permissions
ls -la n8n-data/
```

### Memory issues

```bash
# Check container stats
docker stats marketpulse-n8n

# Increase limit in docker-compose.yml if needed
```

### Backup decryption fails

```bash
# Verify encryption key exists
ls -la secrets/backup_encryption_key

# The encryption key MUST be the same one used to create the backup
```

## Scaling

When you need more resources, see `docs/SCALABILITY_MIGRATION.md` for:

- **Tier 1:** Optimization (free)
- **Tier 2:** Budget VPS ($5-10/mo)
- **Tier 3:** Production VPS ($20-50/mo)
- **Tier 4:** High Availability ($100+/mo)

## VerifiMind Trinity Validation

| Agent | v1.0 | v2.0 | v2.1 |
|-------|------|------|------|
| X Intelligent (Innovation) | - | 7.0 | 7.0 |
| Z Guardian (Ethics) | - | 7.5 | 8.0+ |
| CS Security | - | 7.5 | 8.5+ |
| **Vulnerabilities** | 12+ | 5 | **0** |
| **Veto Status** | TRIGGERED | CLEARED | CLEARED |

## License

MIT License - See original MarketPulse repository.

## Credits

- Original concept: MarketPulse (Bootstrapper's Edge)
- Security hardening: VerifiMind Trinity validation
- Version: 2.1 (Enhanced Security Edition)
