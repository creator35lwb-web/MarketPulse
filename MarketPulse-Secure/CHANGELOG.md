# Changelog

All notable changes to MarketPulse are documented in this file.

## [2.1.1] - 2026-01-18 (API Fix)

### Fixed
- **Fear & Greed API:** Switched from CNN endpoint (now blocked with 418 error) to Alternative.me API
- **Old endpoint:** `https://production.dataviz.cnn.io/index/fearandgreed/graphdata` (deprecated)
- **New endpoint:** `https://api.alternative.me/fng/?limit=1` (working)

### Changed
- Updated workflow to parse Alternative.me API response format
- Fear & Greed Index now shows "Crypto" indicator (Alternative.me tracks crypto market sentiment)
- Updated Bias Monitoring Log to use new API data structure

### Note
The Alternative.me Fear & Greed Index tracks crypto market sentiment, which often correlates with traditional market sentiment. For stock-specific sentiment, the workflow relies on RSS feed analysis and LLM sentiment scoring.

---

## [2.1.0] - 2026-01-18 (Security Enhanced)

### Security Fixes (5 Vulnerabilities Resolved)

#### Vulnerability #1: n8n CVE Exposure
- **Added:** Automated vulnerability scanning with Trivy
- **Added:** CVE monitoring documentation and weekly scan schedule
- **Added:** Version update protocol with severity-based response times
- **File:** `security/CVE_MONITORING.md`

#### Vulnerability #2: Docker Secrets Access Control
- **Added:** Comprehensive secrets hardening guide
- **Added:** Environment variable blocking (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`)
- **Added:** Secret rotation protocol and scripts
- **File:** `security/SECRETS_HARDENING.md`

#### Vulnerability #3: Telegram Alert Information Leakage
- **Added:** Error message sanitization in workflow
- **Added:** Redaction patterns for API keys, tokens, credentials
- **Added:** Message length truncation (500 chars max)
- **Changed:** Error alerts now go to separate admin channel
- **File:** `workflows/marketpulse-workflow-v2.1-secure.json`

#### Vulnerability #4: Bypassable Input Validation
- **Added:** Defense-in-depth validation with 10+ blocked patterns
- **Added:** XSS, script injection, template injection blocking
- **Added:** URL protocol validation (http/https only)
- **Added:** Field length limits and HTML sanitization
- **File:** `workflows/marketpulse-workflow-v2.1-secure.json`

#### Vulnerability #5: Unencrypted Backups
- **Added:** AES-256-CBC encrypted backup script
- **Added:** PBKDF2 key derivation (100k iterations)
- **Added:** SHA256 checksum verification
- **Added:** Encrypted restore script
- **Files:** `scripts/backup-encrypted.sh`, `scripts/restore-encrypted.sh`

### Recommended Steps Implemented

#### Step 1: User Disclaimers
- **Added:** Mandatory financial disclaimer in all Telegram messages
- **Added:** AI limitations warning
- **Added:** "Not financial advice" statement

#### Step 2: AI Bias Monitoring
- **Added:** Bias monitoring node in workflow
- **Added:** Sentiment direction tracking (BULLISH/BEARISH/NEUTRAL)
- **Added:** Correlation logging with Fear & Greed Index

#### Step 3: Scalability Migration Path
- **Added:** 4-tier scaling documentation (Free → Budget → Production → HA)
- **Added:** Migration checklists and rollback plans
- **Added:** Cost projections and provider recommendations
- **File:** `docs/SCALABILITY_MIGRATION.md`

#### Step 4: Separate Admin Channel
- **Added:** `TELEGRAM_ADMIN_CHAT_ID` environment variable
- **Changed:** Error alerts now sent to admin-only channel
- **Changed:** User channel only receives sanitized daily digests

### Other Changes
- **Updated:** docker-compose.yml to v2.1
- **Updated:** .env.example with new security settings
- **Added:** Security scripts directory structure
- **Added:** This CHANGELOG.md file

---

## [2.0.0] - 2026-01-18 (Security Hardened)

### Added
- Traefik reverse proxy with automatic SSL
- Docker Secrets for credential management
- Container security hardening (non-root, read-only, caps dropped)
- Rate limiting (100 req/min)
- Security headers (HSTS, CSP, X-Frame-Options)
- Error Trigger nodes in workflow
- HTTP timeout configuration (30s)
- Batch processing for memory safety
- Health checks
- Comprehensive .gitignore

### Changed
- Pinned n8n to version 1.70.3 (from :latest)
- Memory limits enforced (768MB)
- Telemetry disabled by default

### Security
- Addressed 12 initial vulnerabilities identified by VerifiMind Trinity
- Lifted initial VETO status

---

## [1.0.0] - Original

### Initial Release
- Basic n8n workflow for sentiment analysis
- RSS feed processing
- Groq LLM integration
- Telegram delivery
- Fear & Greed Index integration

### Known Issues (Resolved in 2.0.0)
- No SSL configuration
- No authentication hardening
- :latest Docker tag used
- No error handling
- No input validation
- No secrets management
