#!/usr/bin/env bash
# Prepare files for a fresh Linux/WSL deployment. This does not start services.
set -euo pipefail

setup_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$setup_dir"

for required_command in docker openssl; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
        printf 'Required command is unavailable: %s\n' "$required_command" >&2
        exit 1
    fi
done
if ! docker compose version >/dev/null 2>&1; then
    printf 'The Docker Compose plugin is required.\n' >&2
    exit 1
fi
if [[ ! -f .env.example || ! -f .gitignore ]]; then
    printf 'Restore the checked-in .env.example and .gitignore before setup.\n' >&2
    exit 1
fi

# Compose file secrets are bind mounts. Their files must be readable by n8n UID 1000.
if [[ "$EUID" -ne 0 && "$EUID" -ne 1000 ]]; then
    printf 'Run this setup as UID 1000 or with sudo so secret ownership can match n8n.\n' >&2
    exit 1
fi

umask 077
mkdir -p secrets traefik/dynamic backups
chmod 700 secrets backups
chmod 755 traefik traefik/dynamic

for secret_name in n8n_encryption_key n8n_jwt_secret; do
    secret_path="secrets/$secret_name"
    if [[ -e "$secret_path" ]]; then
        if [[ ! -f "$secret_path" || ! -s "$secret_path" ]]; then
            printf 'Existing secret is not a nonempty file: %s\n' "$secret_path" >&2
            exit 1
        fi
        printf 'Preserved %s\n' "$secret_path"
    else
        openssl rand -hex 32 | tr -d '\n' > "$secret_path"
        printf 'Created %s\n' "$secret_path"
    fi
    chmod 600 "$secret_path"
    if [[ "$EUID" -eq 0 ]]; then
        chown 1000:1000 "$secret_path"
    fi
done

if [[ ! -e traefik/acme.json ]]; then
    touch traefik/acme.json
fi
chmod 600 traefik/acme.json

if [[ ! -f .env ]]; then
    cp .env.example .env
    printf 'Created .env; edit DOMAIN and ACME_EMAIL before HTTPS deployment.\n'
else
    printf 'Preserved existing .env.\n'
fi
chmod 600 .env

printf '\nSetup files are ready. No services were started; no passwords were generated.\n'
printf 'The checked-in .gitignore and existing keys were preserved.\n'
printf 'Back up the encryption key and n8n named volume together before upgrades.\n'
printf 'Start the loopback-only local configuration first and create your n8n owner account.\n'
printf 'Follow README.md for the local-to-HTTPS deployment steps.\n'
