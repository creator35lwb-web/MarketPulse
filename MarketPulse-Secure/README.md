# MarketPulse deployment templates

These templates package the workflow engine for a local machine or a Linux server behind HTTPS. They use n8n owner-account authentication, persistent data, file-mounted encryption keys, and seven days of retained executions so delivery failures can be investigated.

The public workflow is [marketpulse-workflow-CURRENT.json](workflows/marketpulse-workflow-CURRENT.json). Follow [the workflow setup guide](workflows/README.md) to bind credentials, update publication destinations, and configure delivery. The older numbered workflow exports and security reports are historical references.

## Validation scope

The template targets are [n8n 2.38.5](https://github.com/n8n-io/n8n/releases/tag/n8n%402.38.5) and [Traefik 3.7.12](https://github.com/traefik/traefik/releases/tag/v3.7.12). Explicit tags make changes reviewable; they do not prove the absence of vulnerabilities.

Configuration validation uses Docker Compose with the example environment. Container startup, an n8n upgrade or database migration, certificate issuance, account sign-in, and workflow delivery still need a deployment test. No live stack was started as part of the September 10 template repair.

## Fresh local installation

Use Docker with Linux containers, the Docker Compose plugin, Bash and OpenSSL. Run the setup on a Linux filesystem (including WSL), as UID 1000 or as root. File-mounted secrets must be readable by n8n's container UID 1000. If setup requires sudo, use sudo for subsequent deployment commands and editing the generated environment file as well.

```bash
cd MarketPulse-Secure
bash setup.sh
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up -d
```

Open `http://localhost:5678` and create the owner account with an email and a strong password. For a remote server, use an SSH tunnel from your computer:

```bash
ssh -L 5678:127.0.0.1:5678 user@your-server
```

The local port binds to `127.0.0.1`. Complete account creation before moving to public HTTPS. The setup script generates encryption and session keys; it does not generate an account password or print key material. Existing keys, `.env`, certificate storage and `.gitignore` are preserved. There is no `N8N_USER` or `n8n_password` login mechanism in these templates.

For ongoing local use, import the current workflow and follow its setup guide. An HTTPS domain is unnecessary for local configuration.

## Move the initialized installation to HTTPS

Use the same directory and Compose project name for both configurations so they share the `n8n-data` named volume. Do not run the two configurations at the same time.

1. Edit the `.env` created by setup. Set `DOMAIN` to a hostname you control and `ACME_EMAIL` to your certificate contact address.
2. Point the hostname to the server and allow inbound ports 80 and 443. Port 80 is needed for the configured ACME HTTP challenge.
3. Stop the local configuration without deleting its volume, validate the HTTPS configuration, then start it:

```bash
docker compose -f docker-compose.local.yml down
docker compose config --quiet
docker compose up -d
docker compose ps
docker compose logs --tail=100 traefik n8n
```

Do not use `down --volumes`: the named volume contains the owner account, credentials, workflows and execution history. Sign in at `https://your-hostname` using the owner account created locally.

Traefik is the single reverse proxy in this template; `N8N_PROXY_HOPS=1` matches that topology. If you add another proxy, review the proxy configuration before using it. The editor and webhook base URLs use the configured HTTPS hostname.

## What the configuration provides

| Component | Behavior |
|---|---|
| Local n8n | Loopback-only port; persistent named volume; file-mounted encryption key |
| HTTPS n8n | Non-root UID 1000, read-only root filesystem, writable named volume and temporary directory |
| Authentication | n8n owner account and normal session authentication |
| Execution history | Successful and failed executions retained for seven days; manual executions retained in HTTPS mode |
| Traefik | HTTP-to-HTTPS redirect, ACME HTTP challenge, internal healthcheck, no dashboard route |
| Dynamic routing policy | TLS minimum 1.2, response headers and a rate limit of 100 requests/minute with burst 50 |
| Secrets | Files mounted only into n8n; preserve their values together with the data volume |

Traefik's static configuration is entirely in the `command` entries of `docker-compose.yml`. Compose substitutes `ACME_EMAIL` there. [Traefik's static configuration methods are mutually exclusive](https://doc.traefik.io/traefik/v3.7/getting-started/configuration-overview/); do not reintroduce a mounted static YAML file alongside these arguments. TLS options and middleware definitions are loaded from `traefik/dynamic/security.yml` at `/etc/traefik/dynamic`.

The Docker socket mount has an explicit source and destination. A read-only socket mount is not a Docker API permission boundary: keep this host and proxy under operator control. [Compose secrets are bind-mounted files](https://docs.docker.com/compose/how-tos/use-secrets/), so protect their host permissions and backups.

## Verify a deployment

After startup, check the container health and certificate, then sign out and verify that signing back in requires the owner account. Import the workflow while inactive, bind its credentials, and validate both US and China source-only and approved-analysis paths before activating schedules. Confirm Telegram delivery and the separately published dashboard payload; a successful Telegram message does not establish that GitHub publication worked.

Retained execution data can contain report inputs and operational details. Restrict n8n access to intended operators. The historical backup scripts and scan reports are not proof of a tested recovery path or a current vulnerability assessment. Before upgrading, back up the actual named volume and matching encryption keys, and perform a restore drill in a separate environment.

If startup reports a secret-file permission error, check the ownership of `secrets/n8n_encryption_key` and `secrets/n8n_jwt_secret`; their container reader is UID 1000. Do not replace an existing encryption key to fix permissions: stored credentials require the original key.

## Files

- `docker-compose.local.yml`: local n8n configuration and owner-account bootstrap.
- `docker-compose.yml`: HTTPS n8n and Traefik configuration.
- `setup.sh`: idempotent file preparation without starting services.
- `.env.example`: hostname, certificate email and timezone.
- `traefik/dynamic/security.yml`: TLS options and middleware definitions.
- `workflows/README.md`: current workflow import and credential setup.

MarketPulse is provided under the repository's [MIT license](../LICENSE).
