# progress.md

Current task:
Server (78.39.51.105) is unreachable (ping/SSH/HTTP all down) — waiting on user to check host panel.

Completed:
- Docker + docker-compose-v2 installed on server
- docker-compose stack built: db (Postgres), api (Node/Express), caddy (HTTPS via nip.io)
- DB schema: accounts, categories, transactions, installments, investments
- 3 accounts seeded (rasalat, blu, pasargad) with real initial balances
- Default categories seeded (9 expense + قسط + ناشناخته, 2 income + ناشناخته)
- SMS parsers for all 3 banks (parsers.js) — tested working
- Webhook endpoint /api/webhook/sms — tested working (fixed a UTF-8/header bug, switched ntfy calls to JSON payload instead of headers)
- ntfy notifications confirmed received by user (3 test notifications seen)
- PWA built: pending-transaction categorization, transactions list, accounts, installments, investments, categories CRUD
- HTTPS via Caddy + Let's Encrypt on nip.io domain — confirmed working before outage
- iOS Shortcuts automation created for "blu" (message trigger -> POST to webhook) — user built this one; rasalat/pasargad not yet built

Remaining:
- Wait for server to come back online, verify containers survived/restart them
- User needs to build 2 more Shortcuts automations (rasalat, pasargad) — same pattern as blu
- User needs to add webhook URL into all 3 Shortcuts (https://78-39-51-105.nip.io/api/webhook/sms)
- User needs to install ntfy app and subscribe to topic pw-590a5dd3a7f749b1
- User needs to add PWA to home screen
- User has not yet entered any real installments/loans/investments data
- Test full end-to-end flow: real bank SMS -> ntfy notification -> confirm via PWA/action button

Known issue:
- Server went fully unreachable (ping/SSH/HTTP) on 2026-09-18 after a normal SSH session; cause unknown (possibly host-side reboot/outage, or the pending kernel upgrade noted during docker-compose-v2 install). User is investigating via host panel.
- docker compose requires sudo (personalwallet user not in docker group) — every deploy command needs password.
