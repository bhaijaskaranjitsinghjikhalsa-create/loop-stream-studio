#!/usr/bin/env bash
# JSK24Live one-shot installer for Ubuntu (Oracle Cloud free tier tested)
# Usage:  bash install.sh
set -e

echo "==> JSK24Live installer"

# ----- system deps -----
echo "==> Installing system packages (ffmpeg, build tools, curl)..."
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg build-essential python3 ffmpeg

# ----- node 20 -----
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ----- pm2 -----
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2..."
  sudo npm install -g pm2
fi

# ----- app -----
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "==> Installing npm dependencies..."
npm install --omit=dev

if [ ! -f .env ]; then
  echo "==> Creating .env from template..."
  cp .env.example .env
fi

mkdir -p media data logs

# ----- firewall (Ubuntu iptables) -----
PORT=$(grep -E '^PORT=' .env | cut -d= -f2)
PORT=${PORT:-3000}
echo "==> Opening TCP port $PORT in iptables..."
sudo iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT || true
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save || true
else
  sudo apt-get install -y iptables-persistent || true
  sudo netfilter-persistent save || true
fi

# ----- start with pm2 -----
echo "==> Starting JSK24Live under PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n1 | bash || true

PUBIP=$(curl -s ifconfig.me || echo "<your-public-ip>")
echo ""
echo "================================================================"
echo " JSK24Live is running!"
echo " Open:  http://$PUBIP:$PORT"
echo " Login key (default):  jsk@1984    (change in .env)"
echo ""
echo " IMPORTANT: also open port $PORT in Oracle Cloud:"
echo "   VCN -> Security List -> Add Ingress Rule"
echo "   Source 0.0.0.0/0  Protocol TCP  Destination port $PORT"
echo "================================================================"
