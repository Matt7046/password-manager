# Deploy Password Manager (stile Activity Manager)

Flusso:

1. **API** — build immagine Hub → push → sul VPS `pull` + `up --force-recreate` solo `password-manager`
2. **WEB** — `expo export` → upload tar in `/root/password-manager/web` → reload nginx edge (colorsdev-site)


## Setup una tantum

```bat
cd backend\bat\deploy
copy config.bat.example config.bat
notepad config.bat
```

`config.bat` è in `.gitignore`. Preferibile chiave SSH in `DEPLOY_SSH_KEY`.

## Comandi

| Script | Cosa fa |
|--------|---------|
| `DEPLOY-API.BAT` | backend Docker (`matt7046/password-manager:1.0.0`) |
| `DEPLOY-WEB.BAT` | frontend statico PWA |
| `DEPLOY-ALL.BAT` | API + WEB |

Esempi skip:

```bat
set DEPLOY_SKIP_BUILD=1
set DEPLOY_SKIP_PUSH=1
DEPLOY-API.BAT

set DEPLOY_SKIP_EXPORT=1
DEPLOY-WEB.BAT
```

## Note

- Sul VPS la rete Docker è tipicamente `backend_app-network` (`DEPLOY_COMPOSE_NETWORK`).
- Il web è servito da nginx **colorsdev-site** via `/var/www/root/password-manager/web`.
- Per le modifiche solo frontend (UI) basta `DEPLOY-WEB.BAT`.
- Per le modifiche solo `server.py` basta `DEPLOY-API.BAT`.
- SSH: i comandi remoti usano `;` invece di `&&` (su Windows altrimenti docker parte in locale).
