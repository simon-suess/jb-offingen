# Security Audit & Hardening — jb-offingen.de

Date: 2026-08-12

## Summary

Security review of the jb-offingen.de production setup (nginx → Node static server on a 4-core / 12 GB Oracle Cloud ARM VPS, Ubuntu). All findings below were either fixed on the date above or are documented as residual risk.

## Fixed (2026-08-12)

### 1. `.git` directory was publicly served — CRITICAL

`server.js` served every file under the repo root, including `/.git/`. An attacker (IP `144.172.114.107`, 2026-08-12 09:37) already downloaded `/.git/config` (200 OK). The full repo history — including `index.html` at older versions — was readable by anyone.

**Fix:** `server.js` now rejects any path segment starting with `.` (403), blocking `/.git`, `/.env`, `/.well-known`, etc.:
```
/.git/config -> 403   (was 200)
/.env        -> 403
/            -> 200   (unchanged)
```

### 2. Node server bound to all interfaces — MEDIUM

`server.listen(PORT)` bound to `0.0.0.0`, exposing the raw HTTP server on port 3000 directly to the internet, bypassing nginx (and its TLS + rate limiting).

**Fix:** bound to `127.0.0.1`:
```js
server.listen(PORT, '127.0.0.1', ...)
```
`ss -tln` now shows `127.0.0.1:3000` only.

### 3. No firewall — HIGH

UFW was inactive; all ports (22, 80, 443, 111 rpcbind, 25565 Minecraft, 3389 RDP) were open to the world.

**Fix:** UFW enabled with default-deny incoming. Allowed:
- `22/tcp` (SSH, key-only auth)
- `80/tcp`, `443/tcp` (website)
- `25565/tcp` (Minecraft server — kept open by owner decision)
- `3389/tcp` (xrdp — kept open by owner decision)

`rpcbind` (111) and everything else are now blocked.

### 4. No security headers on nginx — MEDIUM

**Fix:** added to the 443 server block:
- `Strict-Transport-Security: max-age=63072000` (HSTS, 2 years)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### 5. nginx version disclosure — LOW

`server_tokens` was on; responses leaked `nginx/1.24.0`.

**Fix:** `server_tokens off;` in `/etc/nginx/nginx.conf`. Responses now report just `Server: nginx`.

### 6. No rate limiting — MEDIUM

Scanner botnets (Censys, zgrab, Palo Alto Xpanse, vuln scanners) hammer the site continuously; the access log showed bursts of hundreds of requests per minute.

**Fix:** `limit_req_zone ... rate=10r/s` with `burst=20 nodelay` on the `/` location.

### 7. `.env` not in `.gitignore` — LOW

No `.env` exists today, but if one was ever created it would have been committed **and** served.

**Fix:** `.gitignore` now ignores `.env`, `.env.*`, `*.pem`, `*.key`, `*.secret`.

### 8. `nginx-config.txt` out of sync with live config — LOW

The repo copy was missing the `jb-offingen.de` port-80 redirect and the `return 404` catch-all.

**Fix:** file re-synced with `/etc/nginx/sites-available/jbo`. **Keep them in sync on every change** (AGENTS.md notes this).

## Not fixed — residual risk (owner decisions / by design)

| Item | Risk | Why left as-is |
|---|---|---|
| Minecraft server on `0.0.0.0:25565` | HIGH — public internet, running as `ubuntu` user | Owner decided to keep it open |
| RDP (xrdp) on `0.0.0.0:3389` | HIGH — brute-force attempts already observed in logs | Owner decided to keep it open |
| Google Sheets URL in `index.html` (published TSV) | LOW — anyone with the URL can read event data | By design; contains no personal data beyond what the site already shows |

### Resource stabilization — Minecraft heap capped (2026-08-12)

All Minecraft launcher scripts under `/home/ubuntu/Servers/` were capped from `-Xmx22G` to `-Xmx10G` (the VPS has 12 GB RAM; a 22G heap guaranteed memory pressure/OOM instability). Affected: `121_10_ende_25`, `121_10_ende_25_paper`, `creative`, `old/*` (all `-Xms5G -Xmx10G`), plus `ATM6TTS` (`MAX_RAM=10G`). SkyFactory (10096M/4096M) and Techopolis (3–4G) were already under the cap.

**Action still required:** the currently running `paper-server.jar` process (PID 5478) was started before the change and still has `-Xmx22G`. Restart it to apply: `kill 5478` then rerun `startServer.sh`, or reboot.

Recommendations for the two open ports, if ever reconsidered:
- Restrict by source IP instead of "Anywhere" (e.g. `ufw allow from <home-IP> to any port 25565 proto tcp`).
- Use `fail2ban` for SSH and RDP brute-force protection.
- Prefer SSH tunneling for RDP rather than exposing it directly.

## Verified healthy (no action needed)

- SSH: key-only auth, root login not permitted via password.
- No secrets/API keys committed in the repo (grep for keys/tokens: clean).
- TLS certificate valid until 2026-10-30, renews automatically via certbot (nginx authenticator).
- Node server: dotfile block verified after pm2 restart; homepage, images, and `impressum.html` still 200.
- HSTS preload: consider submitting the domain to https://hsts.org (optional, after confirming no plain-HTTP clients).

## Quick verification commands

```bash
ufw status verbose                          # firewall rules
ss -tln | grep 3000                         # should show 127.0.0.1:3000
curl -skI https://jb-offingen.de/ | grep -iE "strict-transport|x-content-type|x-frame|server:"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/.git/config   # expect 403
pm2 restart "jb-offingen.de"                # after any server.js change
```
