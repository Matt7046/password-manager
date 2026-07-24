# Password Manager

Stack **autonomo**: API + nginx proprio + Cloudflare Tunnel.
**Nessuna modifica** ai file di Activity Manager.

URL: `https://password.colorsdev.tech`

## Perché il Tunnel

Sul VPS di AM le porte **80/443** sono già di nginx AM.  
Un secondo nginx non può bindarle. Cloudflare Tunnel espone il sottodominio senza toccare AM.

```
App Expo → https://password.colorsdev.tech
                │
         Cloudflare Tunnel
                │
     password-manager-nginx (reverse proxy dedicato)
                │
         password-manager:8000
                │
         Mongo (DB: password_manager)
```

## Setup una tantum

### 1. DNS / Tunnel (Cloudflare Zero Trust)

1. Crea un Tunnel
2. Public hostname: `password.colorsdev.tech` → `http://password-manager-nginx:80`
3. Copia il token in `.env` come `CLOUDFLARE_TUNNEL_TOKEN`

### 2. Env backend sul server

```bash
cd Password-Manager/backend
cp .env.EMPTY .env
# MONGO_URL = stesso di AM
# DB_NAME=password_manager
# SERVER_SECRET=...
# CLOUDFLARE_TUNNEL_TOKEN=...
```

### 3. Deploy (come AM)

**PC:**
```bat
cd backend\bat
BUILD-AND-PUSH.BAT
```

**Server:**
```bash
cd Password-Manager/backend
docker compose pull
docker compose up -d
```

Activity Manager: **zero commit nginx**.

## Frontend

```bash
cd frontend
# EXPO_PUBLIC_BACKEND_URL=https://password.colorsdev.tech
yarn install
npx expo start
```

## Se un giorno hai 80/443 libere

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
```

Serve certificato Let's Encrypt per `password.colorsdev.tech` e `nginx/nginx.conf`.

## Cosa commitare

- Solo repo **Password Manager** (compose, nginx, bat, codice)
- **Non** `.env`
- Activity Manager: niente
