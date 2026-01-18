#!/bin/bash
# ============================================
# MarketPulse Encrypted Backup Script
# Vulnerability #5 Fix: Secure backup encryption
# ============================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-./secrets/backup_encryption_key}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="marketpulse-backup-$DATE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     MarketPulse Encrypted Backup                           ║${NC}"
echo -e "${GREEN}║     $(date '+%Y-%m-%d %H:%M:%S')                                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify encryption key exists
if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
    echo -e "${YELLOW}[!] Backup encryption key not found. Generating...${NC}"
    mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
    openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
    chmod 600 "$ENCRYPTION_KEY_FILE"
    echo -e "${GREEN}[✓] Encryption key generated: $ENCRYPTION_KEY_FILE${NC}"
    echo -e "${RED}[!] CRITICAL: Back up this key securely! Without it, backups cannot be restored.${NC}"
fi

# Create backup directory with secure permissions
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Check if n8n is running
N8N_RUNNING=$(docker compose ps -q n8n 2>/dev/null || echo "")

echo -e "${YELLOW}[1/5] Preparing backup...${NC}"

# Stop n8n for consistent backup (optional but recommended)
if [ -n "$N8N_RUNNING" ]; then
    echo -e "${YELLOW}[2/5] Stopping n8n for consistent backup...${NC}"
    docker compose stop n8n
    RESTART_N8N=true
else
    echo -e "${YELLOW}[2/5] n8n not running, proceeding with backup...${NC}"
    RESTART_N8N=false
fi

# Create temporary directory for backup contents
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${YELLOW}[3/5] Collecting backup data...${NC}"

# Backup n8n data volume
if [ -d "./n8n-data" ]; then
    cp -r ./n8n-data "$TEMP_DIR/n8n-data"
    echo -e "${GREEN}  [✓] n8n data${NC}"
else
    echo -e "${YELLOW}  [!] n8n-data directory not found, skipping${NC}"
fi

# Backup configuration files (NOT secrets)
mkdir -p "$TEMP_DIR/config"
cp -r ./traefik "$TEMP_DIR/config/traefik" 2>/dev/null || true
cp ./docker-compose.yml "$TEMP_DIR/config/" 2>/dev/null || true
cp ./.env.example "$TEMP_DIR/config/" 2>/dev/null || true
echo -e "${GREEN}  [✓] Configuration files${NC}"

# Backup workflow templates
if [ -d "./workflows" ]; then
    cp -r ./workflows "$TEMP_DIR/workflows"
    echo -e "${GREEN}  [✓] Workflow templates${NC}"
fi

# Create backup manifest
cat > "$TEMP_DIR/MANIFEST.json" << EOF
{
    "backup_date": "$(date -Iseconds)",
    "backup_version": "2.1",
    "hostname": "$(hostname)",
    "components": {
        "n8n_data": $([ -d "$TEMP_DIR/n8n-data" ] && echo "true" || echo "false"),
        "config": true,
        "workflows": $([ -d "$TEMP_DIR/workflows" ] && echo "true" || echo "false")
    },
    "encryption": "AES-256-CBC",
    "checksum_algorithm": "SHA256"
}
EOF

# Create unencrypted tarball
echo -e "${YELLOW}[4/5] Creating encrypted backup archive...${NC}"

UNENCRYPTED_TAR="$TEMP_DIR/$BACKUP_NAME.tar.gz"
tar -czf "$UNENCRYPTED_TAR" -C "$TEMP_DIR" \
    --exclude="*.tar.gz" \
    .

# Calculate checksum of unencrypted data
CHECKSUM=$(sha256sum "$UNENCRYPTED_TAR" | cut -d' ' -f1)
echo "$CHECKSUM" > "$TEMP_DIR/checksum.sha256"

# Encrypt the backup using AES-256-CBC
ENCRYPTED_BACKUP="$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$UNENCRYPTED_TAR" \
    -out "$ENCRYPTED_BACKUP" \
    -pass file:"$ENCRYPTION_KEY_FILE"

# Save checksum alongside encrypted backup
echo "$CHECKSUM  $BACKUP_NAME.tar.gz" > "$BACKUP_DIR/$BACKUP_NAME.sha256"

# Set secure permissions on backup
chmod 600 "$ENCRYPTED_BACKUP"
chmod 600 "$BACKUP_DIR/$BACKUP_NAME.sha256"

echo -e "${GREEN}  [✓] Backup encrypted with AES-256-CBC${NC}"

# Restart n8n if it was running
if [ "$RESTART_N8N" = true ]; then
    echo -e "${YELLOW}[5/5] Restarting n8n...${NC}"
    docker compose start n8n
    echo -e "${GREEN}  [✓] n8n restarted${NC}"
else
    echo -e "${YELLOW}[5/5] Skipping n8n restart (was not running)${NC}"
fi

# Cleanup old backups
echo -e "${YELLOW}[*] Cleaning up backups older than $RETENTION_DAYS days...${NC}"
find "$BACKUP_DIR" -name "marketpulse-backup-*.tar.gz.enc" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "marketpulse-backup-*.sha256" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Calculate backup size
BACKUP_SIZE=$(du -h "$ENCRYPTED_BACKUP" | cut -f1)

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Backup Complete                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Backup file: ${GREEN}$ENCRYPTED_BACKUP${NC}"
echo -e "  Checksum:    ${GREEN}$BACKUP_DIR/$BACKUP_NAME.sha256${NC}"
echo -e "  Size:        ${GREEN}$BACKUP_SIZE${NC}"
echo -e "  Encryption:  ${GREEN}AES-256-CBC (PBKDF2, 100k iterations)${NC}"
echo ""
echo -e "${YELLOW}To restore this backup, run:${NC}"
echo -e "  ./scripts/restore-encrypted.sh $ENCRYPTED_BACKUP"
echo ""
