# JSK24Live — 24/7 Loop Streaming Panel

Self-hosted streaming control panel jo videos nu YouTube / Facebook / Twitch / kise v RTMP destination te 24/7 loop te live stream krda. Pink-purple professional UI, real-time CPU/RAM stats, video library, multi-stream support, auto-stop timer.

## Features

- Multi-destination RTMP push (YouTube Live, Facebook Live, Twitch, custom RTMP servers)
- 24/7 infinite loop OR fixed-hour timer (1–24h, baad ch auto-stop)
- Video library: upload, rename, delete, drag-and-drop playlist ordering
- Quality presets: 360p / 480p / 720p / 1080p, OR low-CPU "copy" mode (no transcoding)
- Live ffmpeg log console per stream (via Socket.IO)
- Real-time system stats: CPU, RAM, disk, network
- Single admin-key login (change in `.env`)
- Mobile responsive — kise v device to manage karo

## Quick Install (Oracle Cloud / Ubuntu VPS)

```bash
git clone <this-repo-url> jsk24live
cd jsk24live
bash install.sh
```

Installer apne aap install krda:
- Node.js 20
- ffmpeg
- PM2 (auto-restart on reboot)
- npm dependencies
- iptables port rule

Phir browser ch khol:  `http://<your-public-ip>:3000`
Default login key:  `jsk@1984`  (badlo `.env` ch)

### Oracle Cloud zaroori step

Sirf iptables open krn naal kafi nahi — Oracle de VCN ch v port open krna paunda:

1. Oracle Cloud Console → Networking → Virtual Cloud Networks
2. Apni VCN te click karo → Security Lists → Default Security List
3. "Add Ingress Rules" → Source `0.0.0.0/0`, Protocol `TCP`, Destination port `3000`
4. Save

## Manual Install

```bash
# 1. Install ffmpeg + Node 20
sudo apt update && sudo apt install -y ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# 2. Install deps
npm install --omit=dev

# 3. Configure
cp .env.example .env
nano .env   # ADMIN_KEY badlo, SESSION_SECRET badlo

# 4. Run
node server/index.js
# OR with PM2:
sudo npm i -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## Usage

1. Open `http://<ip>:3000`, login with admin key.
2. **Videos** page → upload MP4/MKV/MOV files.
3. **Streams** page → "New Stream":
   - Naam (e.g. "YouTube Music 24/7")
   - RTMP URL (e.g. `rtmp://a.rtmp.youtube.com/live2`)
   - Stream Key (YouTube/FB Studio to copy karo)
   - Videos select karo (multi, order set karo)
   - Loop: infinite ya hours (1–24)
   - Quality preset
4. **Start** — stream live ho jandi, live log dikhda hai.
5. Set timer ta hours baad apne aap stop ho jandi.

## RTMP URLs Reference

| Service | Server URL |
|---|---|
| YouTube Live | `rtmp://a.rtmp.youtube.com/live2` |
| Facebook Live | `rtmps://live-api-s.facebook.com:443/rtmp` |
| Twitch | `rtmp://live.twitch.tv/app` |
| Custom | Use whatever your service provides |

Stream key alag-alag service to milda — YouTube Studio / Facebook Live Producer / Twitch Dashboard.

## CPU / VPS Sizing

- **Oracle E2.1.Micro (1 OCPU, 1 GB)**: 1 stream @ 720p `copy` mode comfortably. Transcoding heavy hai.
- **Oracle A1.Flex (4 OCPU, 24 GB free)**: multiple 1080p streams transcoded.
- "Copy" mode video re-encode nahi krda — sabh to fast, lowest CPU. Source files same codec/resolution hone chahide.

## File Layout

```
jsk24live/
├── server/
│   ├── index.js          Express + Socket.IO entry
│   ├── auth.js           admin-key middleware
│   ├── db.js             sqlite schema
│   ├── ffmpeg.js         command builder + ffprobe
│   ├── streamer.js       StreamManager (spawn, loop, timer, logs)
│   ├── routes/           videos.js / streams.js / stats.js
│   ├── views/            EJS templates (UI pages)
│   └── public/           CSS, JS, logo
├── media/                uploaded videos (gitignored)
├── data/                 sqlite db (gitignored)
├── logs/                 PM2 logs (gitignored)
├── install.sh
├── ecosystem.config.js
└── .env.example
```

## License

MIT — JSK24Live
