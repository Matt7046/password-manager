# Password Manager

Vault password sync — Expo PWA + FastAPI + MongoDB.

URL: `https://password.colorsdev.tech`

## Architettura (produzione)

DNS su **GoDaddy** → VPS → **nginx Activity Manager** (conf in `/root/nginx-apps/`) + container API sulla rete Docker condivisa.

```
App / PWA → https://password.colorsdev.tech
                │
         GoDaddy DNS (A → VPS)
                │
     nginx AM (80/443 + Let's Encrypt)
      ├─ /           → /var/www/password-manager-web  (Expo export)
      └─ /api/       → password-manager:8000
                │
         Mongo (DB: password_manager)
```

File chiave:
- conf vhost: `backend/nginx/password.colorsdev.tech.conf` → sul VPS in `/root/nginx-apps/`
- web statico: `/root/password-manager/web`
- API: container `password-manager` su `backend_app-network`

## Setup una tantum

### 1. DNS (GoDaddy)

Record **A** per `password` (o `password.colorsdev.tech`) → IP del VPS.

### 2. Env backend sul server

```bash
cd /root/password-manager/backend
cp .env.EMPTY .env
# MONGO_URL = stesso cluster di AM (X509)
# DB_NAME=password_manager
# SERVER_SECRET=...lungo e random...
# Certificati in ./certificate/ (client.pem + client-key.pem)
```

### 3. Nginx AM + certificato

1. Copia `password.colorsdev.tech.conf` in `/root/nginx-apps/`
2. Mount web in compose AM: `/root/password-manager/web:/var/www/password-manager-web:ro`
3. Certbot per `password.colorsdev.tech`
4. Recreate/reload container `nginx` di AM

### 4. Deploy da PC

```bat
cd backend\bat\deploy
copy config.bat.example config.bat
DEPLOY-ALL.BAT
```

Solo API: `DEPLOY-API.BAT`  
Solo web: `DEPLOY-WEB.BAT`

Dettagli: `backend/bat/deploy/README.md`.

## Frontend (dev)

```bash
cd frontend
# EXPO_PUBLIC_BACKEND_URL=https://password.colorsdev.tech
# oppure http://localhost:8000 in locale
yarn install
npx expo start
```

## Cosa commitare

- Repo **Password Manager** (compose, nginx conf, bat, codice)
- **Non** `.env`, certificati `.pem`, `deploy/config.bat`
- Su Activity Manager: solo mount web + include `nginx-apps` (già previsti in compose)
