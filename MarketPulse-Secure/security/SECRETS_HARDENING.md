# Docker Secrets Access Control Hardening

**Version:** 2.1
**Vulnerability:** #2 - Docker Secrets Exposure
**Risk Level:** Medium

---

## 1. Threat Model

### Attack Vectors
1. **Workflow credential extraction** - Malicious workflow accessing secrets
2. **Container escape** - Breaking out to read secret files
3. **Volume mount exploitation** - Accessing secrets through shared volumes
4. **Environment variable leakage** - Secrets exposed in logs or errors

### Assets at Risk
- n8n encryption key (data loss if compromised)
- n8n admin password (full system access)
- API keys (Groq, Gemini, Telegram)
- JWT secret (session hijacking)

---

## 2. Hardening Measures

### 2.1 File-Based Secrets (Implemented)

Secrets are stored as files, not environment variables:

```yaml
# docker-compose.yml
secrets:
  n8n_password:
    file: ./secrets/n8n_password
  n8n_encryption_key:
    file: ./secrets/n8n_encryption_key
  n8n_jwt_secret:
    file: ./secrets/n8n_jwt_secret
```

### 2.2 Secret File Permissions

```bash
# Set restrictive permissions
chmod 700 ./secrets
chmod 600 ./secrets/*

# Verify ownership (should be root or deployment user only)
ls -la ./secrets/
# Expected: -rw------- 1 root root ... n8n_password
```

### 2.3 n8n Environment Variable Blocking

Prevent workflows from accessing environment variables:

```yaml
environment:
  # CRITICAL: Block env access in Code nodes
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=true

  # Use file-based secrets instead of direct env vars
  - N8N_BASIC_AUTH_PASSWORD_FILE=/run/secrets/n8n_password
  - N8N_ENCRYPTION_KEY_FILE=/run/secrets/n8n_encryption_key
```

### 2.4 Read-Only Secret Mounting

Secrets are mounted read-only inside the container:

```yaml
services:
  n8n:
    secrets:
      - source: n8n_password
        target: /run/secrets/n8n_password
        mode: 0400  # Read-only for owner
      - source: n8n_encryption_key
        target: /run/secrets/n8n_encryption_key
        mode: 0400
```

---

## 3. API Key Security

### 3.1 n8n Credential Encryption

n8n encrypts stored credentials using `N8N_ENCRYPTION_KEY`:

```
┌─────────────────┐     ┌─────────────────┐
│  API Key Input  │────▶│  AES-256-GCM    │────▶ SQLite DB
│  (plaintext)    │     │  Encryption     │      (encrypted)
└─────────────────┘     └─────────────────┘
                              ▲
                              │
                    N8N_ENCRYPTION_KEY
```

### 3.2 Credential Access Audit

Monitor credential access in n8n logs:

```bash
# Enable credential audit logging
docker compose logs n8n | grep -i "credential"
```

### 3.3 Principle of Least Privilege

Create separate credentials for each service:

| Credential | Scope | Permissions |
|------------|-------|-------------|
| Groq API | LLM only | Read-only inference |
| Telegram Bot | Alerts only | Send messages to specific chat |
| Gemini API | Backup LLM | Read-only inference |

---

## 4. Secret Rotation Protocol

### 4.1 Rotation Schedule

| Secret | Rotation Period | Method |
|--------|----------------|--------|
| n8n_password | 90 days | Manual regeneration |
| n8n_jwt_secret | 90 days | Manual regeneration |
| API keys | On compromise | Provider dashboard |
| n8n_encryption_key | **NEVER** | Data loss risk |

### 4.2 Password Rotation Script

```bash
#!/bin/bash
# rotate-password.sh - Rotate n8n admin password

set -euo pipefail

SECRETS_DIR="./secrets"
BACKUP_DIR="./secrets/rotated"

# Backup old password
mkdir -p "$BACKUP_DIR"
cp "$SECRETS_DIR/n8n_password" "$BACKUP_DIR/n8n_password.$(date +%Y%m%d)"

# Generate new password
openssl rand -base64 32 | tr -d '\n' > "$SECRETS_DIR/n8n_password"
chmod 600 "$SECRETS_DIR/n8n_password"

# Restart n8n to apply
docker compose restart n8n

echo "Password rotated. New password:"
cat "$SECRETS_DIR/n8n_password"
echo ""
echo "⚠️  Update your password manager and delete this terminal output!"
```

---

## 5. Monitoring & Detection

### 5.1 Suspicious Activity Indicators

Monitor for:
- Multiple failed authentication attempts
- Credential access from unexpected workflows
- Environment variable access attempts (blocked)
- Unusual API call patterns

### 5.2 Log Monitoring

```bash
# Watch for credential-related events
docker compose logs -f n8n | grep -E "(credential|auth|secret|password)"
```

### 5.3 Alert on Suspicious Access

Add to monitoring workflow:
```javascript
// Detect credential access anomalies
const suspiciousPatterns = [
  /credential.*access/i,
  /authentication.*failed/i,
  /secret.*exposed/i
];
```

---

## 6. Compliance Verification

Run this checklist monthly:

- [ ] Secret files have 600 permissions
- [ ] Secrets directory has 700 permissions
- [ ] `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` is set
- [ ] No secrets in docker-compose.yml (only file references)
- [ ] No secrets in .env file (only non-sensitive config)
- [ ] Credentials encrypted in n8n database
- [ ] Password last rotated within 90 days
- [ ] API keys reviewed for minimal permissions
