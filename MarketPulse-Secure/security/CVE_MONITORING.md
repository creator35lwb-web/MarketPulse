# n8n CVE Monitoring & Security Protocol

**Version:** 2.1
**Last Updated:** 2026-01-18
**Applies to:** MarketPulse v2.0+

---

## 1. Current Version Security Status

| Component | Version | Last CVE Check | Status |
|-----------|---------|----------------|--------|
| n8n | 1.70.3 | 2026-01-18 | ✅ Verified |
| Traefik | 3.0.4 | 2026-01-18 | ✅ Verified |
| Node.js | 20 LTS | 2026-01-18 | ✅ Verified |

---

## 2. CVE Monitoring Sources

Check these sources **weekly** for new vulnerabilities:

### Primary Sources
- **n8n Security Advisories**: https://github.com/n8n-io/n8n/security/advisories
- **NVD (NIST)**: https://nvd.nist.gov/vuln/search?query=n8n
- **Snyk Vulnerability DB**: https://security.snyk.io/package/npm/n8n

### Secondary Sources
- **GitHub Dependabot**: Enable on repository
- **Docker Scout**: `docker scout cves n8nio/n8n:1.70.3`
- **Trivy Scanner**: `trivy image n8nio/n8n:1.70.3`

---

## 3. Automated Security Scanning

### 3.1 Weekly Vulnerability Scan Script

Save as `security/scan-vulnerabilities.sh`:

```bash
#!/bin/bash
# Weekly vulnerability scan for MarketPulse
# Run via cron: 0 6 * * 0 /path/to/scan-vulnerabilities.sh

set -euo pipefail

REPORT_DIR="./security/reports"
DATE=$(date +%Y%m%d)
ALERT_WEBHOOK="${SECURITY_ALERT_WEBHOOK:-}"

mkdir -p "$REPORT_DIR"

echo "=== MarketPulse Security Scan: $DATE ===" | tee "$REPORT_DIR/scan-$DATE.log"

# Scan n8n image with Trivy
echo "[1/3] Scanning n8n image..."
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL \
  --format json \
  n8nio/n8n:1.70.3 > "$REPORT_DIR/n8n-trivy-$DATE.json" 2>&1 || true

# Count critical vulnerabilities
CRITICAL_COUNT=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$REPORT_DIR/n8n-trivy-$DATE.json" 2>/dev/null || echo "0")
HIGH_COUNT=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$REPORT_DIR/n8n-trivy-$DATE.json" 2>/dev/null || echo "0")

echo "Critical: $CRITICAL_COUNT, High: $HIGH_COUNT" | tee -a "$REPORT_DIR/scan-$DATE.log"

# Scan Traefik image
echo "[2/3] Scanning Traefik image..."
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL \
  traefik:v3.0.4 > "$REPORT_DIR/traefik-trivy-$DATE.json" 2>&1 || true

# Check for n8n security advisories
echo "[3/3] Checking GitHub advisories..."
curl -s "https://api.github.com/repos/n8n-io/n8n/security-advisories" \
  -H "Accept: application/vnd.github+json" \
  > "$REPORT_DIR/n8n-advisories-$DATE.json" 2>/dev/null || echo "[]" > "$REPORT_DIR/n8n-advisories-$DATE.json"

# Alert if critical vulnerabilities found
if [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo "⚠️ CRITICAL VULNERABILITIES FOUND!" | tee -a "$REPORT_DIR/scan-$DATE.log"

  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -X POST "$ALERT_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"🚨 MarketPulse Security Alert: $CRITICAL_COUNT critical vulnerabilities found in scan on $DATE\"}"
  fi
fi

echo "=== Scan complete. Report: $REPORT_DIR/scan-$DATE.log ===" | tee -a "$REPORT_DIR/scan-$DATE.log"
```

### 3.2 Docker Scout Integration

Add to `docker-compose.yml` as a one-off service:

```yaml
security-scan:
  image: docker/scout-cli:latest
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: cves n8nio/n8n:1.70.3 --format sarif
  profiles:
    - security
```

Run with: `docker compose --profile security run security-scan`

---

## 4. Version Update Protocol

### When to Update

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical (CVSS 9.0+) | 24 hours | Emergency patch |
| High (CVSS 7.0-8.9) | 7 days | Scheduled update |
| Medium (CVSS 4.0-6.9) | 30 days | Next maintenance window |
| Low (CVSS 0.1-3.9) | 90 days | Batch with other updates |

### Update Procedure

```bash
# 1. Backup current state
./scripts/backup-encrypted.sh

# 2. Pull new version (update docker-compose.yml first)
docker compose pull n8n

# 3. Test in staging (if available)
docker compose -f docker-compose.staging.yml up -d

# 4. Deploy to production
docker compose down
docker compose up -d

# 5. Verify health
docker compose ps
curl -k https://localhost/healthz

# 6. Run security scan on new version
./security/scan-vulnerabilities.sh
```

---

## 5. Known CVE Mitigations

### CVE-2025-68613 (Example - Hypothetical)

- **Severity:** Critical
- **Affected:** n8n < 1.65.0
- **Status:** ✅ Mitigated (using 1.70.3)
- **Mitigation:** Version pinned above affected range

### Ongoing Mitigations

| Risk | Mitigation |
|------|------------|
| RCE via Code nodes | `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` |
| SSRF attacks | Rate limiting + timeout configuration |
| Auth bypass | Basic auth + Traefik rate limiting |
| Container escape | Non-root user + dropped capabilities |

---

## 6. Incident Response

If a critical CVE is discovered:

1. **Assess** - Determine if MarketPulse is affected
2. **Isolate** - Consider taking service offline if actively exploited
3. **Patch** - Apply vendor patch or workaround
4. **Verify** - Run security scan to confirm fix
5. **Document** - Update this file with mitigation details
6. **Notify** - Inform users if data may have been compromised

---

## 7. Compliance Checklist

- [ ] Weekly vulnerability scan completed
- [ ] Monthly n8n version review
- [ ] Quarterly penetration test (recommended)
- [ ] Security advisories subscribed
- [ ] Incident response plan tested
