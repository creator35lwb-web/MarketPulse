#!/bin/bash
# MarketPulse Security-Hardened Setup Script
# Version: 2.0
# This script initializes the secure deployment environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     MarketPulse Security-Hardened Setup                    ║${NC}"
echo -e "${GREEN}║     Version 2.0                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

if ! command -v openssl &> /dev/null; then
    echo -e "${RED}ERROR: OpenSSL is not installed. Please install OpenSSL first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"

# Create directory structure
echo -e "${YELLOW}[2/7] Creating directory structure...${NC}"

mkdir -p secrets
mkdir -p traefik/dynamic
mkdir -p n8n-data
mkdir -p backups

chmod 700 secrets
chmod 755 traefik traefik/dynamic
chmod 755 n8n-data
chmod 755 backups

echo -e "${GREEN}✓ Directories created${NC}"

# Generate secrets
echo -e "${YELLOW}[3/7] Generating secure secrets...${NC}"

if [ ! -f secrets/n8n_password ]; then
    openssl rand -base64 32 | tr -d '\n' > secrets/n8n_password
    echo -e "${GREEN}✓ Generated n8n_password${NC}"
else
    echo -e "${YELLOW}⚠ n8n_password already exists, skipping${NC}"
fi

if [ ! -f secrets/n8n_encryption_key ]; then
    openssl rand -hex 32 > secrets/n8n_encryption_key
    echo -e "${GREEN}✓ Generated n8n_encryption_key${NC}"
else
    echo -e "${YELLOW}⚠ n8n_encryption_key already exists, skipping${NC}"
fi

if [ ! -f secrets/n8n_jwt_secret ]; then
    openssl rand -hex 32 > secrets/n8n_jwt_secret
    echo -e "${GREEN}✓ Generated n8n_jwt_secret${NC}"
else
    echo -e "${YELLOW}⚠ n8n_jwt_secret already exists, skipping${NC}"
fi

chmod 600 secrets/*
echo -e "${GREEN}✓ Secret permissions secured (600)${NC}"

# Create acme.json for Let's Encrypt
echo -e "${YELLOW}[4/7] Setting up Let's Encrypt storage...${NC}"

if [ ! -f traefik/acme.json ]; then
    touch traefik/acme.json
    chmod 600 traefik/acme.json
    echo -e "${GREEN}✓ Created acme.json with secure permissions${NC}"
else
    echo -e "${YELLOW}⚠ acme.json already exists${NC}"
fi

# Create .env file if not exists
echo -e "${YELLOW}[5/7] Checking environment configuration...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ Created .env from .env.example - PLEASE EDIT THIS FILE${NC}"
    else
        echo -e "${RED}ERROR: No .env or .env.example file found${NC}"
        echo -e "${RED}Please create .env with required variables${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Set correct ownership for n8n data
echo -e "${YELLOW}[6/7] Setting ownership for n8n data directory...${NC}"

# n8n runs as user 1000:1000
if [ "$(id -u)" -eq 0 ]; then
    chown -R 1000:1000 n8n-data
    echo -e "${GREEN}✓ Ownership set to 1000:1000${NC}"
else
    echo -e "${YELLOW}⚠ Not running as root, please run: sudo chown -R 1000:1000 n8n-data${NC}"
fi

# Create .gitignore
echo -e "${YELLOW}[7/7] Creating .gitignore...${NC}"

cat > .gitignore << 'EOF'
# Secrets - NEVER commit
secrets/
*.env
.env
.env.*
!.env.example

# n8n data
n8n-data/
*.sqlite

# Credentials and workflows with credentials
**/credentials.json
**/workflow-*.json

# SSL certificates
certs/
traefik/acme.json

# Backup files
backups/
*.tar.gz
*.bak

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo
EOF

echo -e "${GREEN}✓ .gitignore created${NC}"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Setup Complete!                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit .env file with your domain and email"
echo "2. Configure your DNS A record to point to this server"
echo "3. Run: docker compose up -d"
echo "4. Access n8n at: https://your-domain.com"
echo ""
echo -e "${YELLOW}Your n8n credentials:${NC}"
echo "Username: Check N8N_USER in .env file"
echo "Password: $(cat secrets/n8n_password)"
echo ""
echo -e "${RED}IMPORTANT: Save this password securely and delete this message!${NC}"
