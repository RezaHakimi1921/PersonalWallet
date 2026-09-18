# Project Rules

## Stack
- Node.js (Express) API
- PostgreSQL
- Docker / docker-compose
- Caddy (reverse proxy + HTTPS via nip.io)
- Vanilla JS PWA (no framework)
- ntfy for push notifications
- iOS Shortcuts (SMS automation) as the data source

## Rules
- Keep changes minimal
- Do not refactor unrelated code
- Do not create files unless necessary
- Prefer existing utilities (parsers.js, ntfy.js)
- Do not change database schema without approval
- Always test changed code (curl the endpoint or check container logs)
- Keep final responses concise

## SQL Rules
- Prefer parameterized queries ($1, $2, ... with pg)
- Do not use SELECT *
- Preserve existing naming conventions (snake_case, _rial suffix for money columns)
- All monetary values stored in Rial; convert to Toman only at display/notification time

## Deploy
- Server: personalwallet@78.39.51.105:2238 (SSH key: ~/.ssh/personalwallet_key)
- Project path on server: ~/personalwallet
- Rebuild after change: `sudo docker compose up -d --build <service>`
- Domain: https://78-39-51-105.nip.io (no real domain yet)
