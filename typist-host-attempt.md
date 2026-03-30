# Typist Deployment — What Was Done & What's Left

## What's Already Done on Clankie

- Repo cloned to `/home/clankie/workspace/truck-typer`
- `docker-compose.yml` patched to use port `8181:80` (port 80 is taken by booksite)
- Containers built and running: `docker compose up -d` succeeded
- Confirmed working: `curl http://localhost:8181/` returns the HTML page

## What Still Needs to Happen

### 1. SSL cert for `type.valkyriextruck.com`

Certbot needs root. Run this on clankie:

```bash
sudo certbot certonly --webroot \
  -w /home/clankie/workspace/booksite/certbot \
  -d type.valkyriextruck.com
```

(Assumes DNS A record for `type.valkyriextruck.com` already points to the server.)

If you want to expand the existing `valkyriextruck.com` cert instead:

```bash
sudo certbot certonly --webroot \
  -w /home/clankie/workspace/booksite/certbot \
  -d valkyriextruck.com \
  -d beta.valkyriextruck.com \
  -d type.valkyriextruck.com \
  --expand
```

### 2. Add nginx server block to booksite

Edit `/home/clankie/workspace/booksite/nginx/nginx.conf` and add these two server blocks inside the `http {}` block:

```nginx
# HTTP redirect for type.valkyriextruck.com
server {
    listen 80;
    server_name type.valkyriextruck.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS for type.valkyriextruck.com → typist on host port 8181
server {
    listen 443 ssl http2;
    server_name type.valkyriextruck.com;

    ssl_certificate     /etc/letsencrypt/live/valkyriextruck.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valkyriextruck.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://172.18.0.1:8181;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Note: `172.18.0.1` is the Docker gateway of `nextjs-go-app_app-network` — the host as seen from inside the booksite nginx container. This routes nginx → host port 8181 → typist frontend container.

### 3. Reload booksite nginx

```bash
cd /home/clankie/workspace/booksite
docker compose exec nginx nginx -s reload
# or
docker compose restart nginx
```

### 4. DNS

Add an A record for `type.valkyriextruck.com` pointing to the server's IP if not already done.
Server IPv6: `2600:3c06::2000:aaff:fe72:3af0`

---

## Keeping Typist Updated

To pull and redeploy after a code push:

```bash
cd /home/clankie/workspace/truck-typer
git pull
docker compose up -d --build
```
