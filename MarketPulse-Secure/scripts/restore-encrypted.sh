#!/bin/bash
# ============================================
# MarketPulse Encrypted Backup Restore Script
# Vulnerability #5 Fix: Secure backup restoration
# ============================================

set -euo pipefail

# Configuration
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-./secrets/backup_encryption_key}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Usage: $0 <backup_file.tar.gz.enc>${NC}"
    echo ""
    echo "Available backups:"
    ls -la ./backups/*.enc 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     MarketPulse Encrypted Backup Restore                   ║${NC}"
echo -e "${GREEN}║     $(date '+%Y-%m-%d %H:%M:%S')                                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}[✗] Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Verify encryption key exists
if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
    echo -e "${RED}[✗] Encryption key not found: $ENCRYPTION_KEY_FILE${NC}"
    echo -e "${RED}    Cannot restore backup without the original encryption key.${NC}"
    exit 1
fi

# Verify checksum file exists
CHECKSUM_FILE="${BACKUP_FILE%.tar.gz.enc}.sha256"
if [ ! -f "$CHECKSUM_FILE" ]; then
    echo -e "${YELLOW}[!] Checksum file not found: $CHECKSUM_FILE${NC}"
    echo -e "${YELLOW}    Proceeding without integrity verification.${NC}"
    VERIFY_CHECKSUM=false
else
    VERIFY_CHECKSUM=true
fi

# Confirm restore
echo -e "${YELLOW}WARNING: This will overwrite existing n8n data!${NC}"
echo ""
echo -e "Backup file: ${GREEN}$BACKUP_FILE${NC}"
echo ""
read -p "Are you sure you want to restore? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${YELLOW}[1/5] Decrypting backup...${NC}"

# Decrypt backup
DECRYPTED_TAR="$TEMP_DIR/backup.tar.gz"
openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in "$BACKUP_FILE" \
    -out "$DECRYPTED_TAR" \
    -pass file:"$ENCRYPTION_KEY_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}[✗] Decryption failed. Wrong encryption key?${NC}"
    exit 1
fi

echo -e "${GREEN}  [✓] Backup decrypted${NC}"

# Verify checksum
if [ "$VERIFY_CHECKSUM" = true ]; then
    echo -e "${YELLOW}[2/5] Verifying integrity...${NC}"
    EXPECTED_CHECKSUM=$(cut -d' ' -f1 "$CHECKSUM_FILE")
    ACTUAL_CHECKSUM=$(sha256sum "$DECRYPTED_TAR" | cut -d' ' -f1)

    if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
        echo -e "${GREEN}  [✓] Checksum verified${NC}"
    else
        echo -e "${RED}[✗] Checksum mismatch! Backup may be corrupted.${NC}"
        echo -e "  Expected: $EXPECTED_CHECKSUM"
        echo -e "  Actual:   $ACTUAL_CHECKSUM"
        read -p "Continue anyway? (yes/no): " CONTINUE
        if [ "$CONTINUE" != "yes" ]; then
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}[2/5] Skipping integrity verification (no checksum file)${NC}"
fi

# Extract backup
echo -e "${YELLOW}[3/5] Extracting backup...${NC}"
tar -xzf "$DECRYPTED_TAR" -C "$TEMP_DIR"
echo -e "${GREEN}  [✓] Backup extracted${NC}"

# Read manifest
if [ -f "$TEMP_DIR/MANIFEST.json" ]; then
    echo -e "${GREEN}  [✓] Manifest found${NC}"
    cat "$TEMP_DIR/MANIFEST.json"
    echo ""
fi

# Stop n8n
echo -e "${YELLOW}[4/5] Stopping n8n...${NC}"
docker compose stop n8n 2>/dev/null || true
echo -e "${GREEN}  [✓] n8n stopped${NC}"

# Restore data
echo -e "${YELLOW}[5/5] Restoring data...${NC}"

# Backup current data (just in case)
if [ -d "./n8n-data" ]; then
    mv ./n8n-data "./n8n-data.pre-restore.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}  [✓] Current data backed up${NC}"
fi

# Restore n8n data
if [ -d "$TEMP_DIR/n8n-data" ]; then
    cp -r "$TEMP_DIR/n8n-data" ./n8n-data
    chown -R 1000:1000 ./n8n-data 2>/dev/null || true
    echo -e "${GREEN}  [✓] n8n data restored${NC}"
fi

# Restart n8n
echo -e "${YELLOW}[*] Restarting n8n...${NC}"
docker compose start n8n
echo -e "${GREEN}  [✓] n8n restarted${NC}"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Restore Complete                                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  n8n data restored from: ${GREEN}$BACKUP_FILE${NC}"
echo ""
echo -e "${YELLOW}Please verify:${NC}"
echo -e "  1. Access n8n at https://your-domain.com"
echo -e "  2. Check that workflows are intact"
echo -e "  3. Verify credentials are working"
echo ""
