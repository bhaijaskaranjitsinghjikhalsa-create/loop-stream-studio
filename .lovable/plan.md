# JSK24Live — 24/7 Loop Streaming Panel

Ek **standalone Node.js app** banauna jo tusi Oracle VPS (Ubuntu, 1 vCPU / 1 GB / VM.Standard.E2.1.Micro) te `git clone` krke chala sakde ho. Lovable da Cloudflare runtime ffmpeg nahi chala sakda, isliye saara code self-host hovega — Lovable da repo sirf source code rakhega.

## Tech Stack

- **Backend:** Node.js 20 + Express + better-sqlite3 (file DB, koi external DB nahi) + Socket.IO (live logs/stats)
- **Streaming:** `ffmpeg` (system binary, `apt install ffmpeg`) spawn as child process per stream
- **Uploads:** Multer → `./media/` folder (VPS local disk)
- **Frontend:** React (Vite) + TailwindCSS, pink/purple theme, built into `dist/` served by Express
- **Auth:** Single admin key `jsk@1984` stored in `.env` → simple login page sets HTTP-only cookie
- **Process manager:** PM2 (auto-restart on reboot)

## Features

**Dashboard**

- Live CPU %, RAM, disk, network (via `os` + `systeminformation`), refresh har 2 sec
- Active streams count, total uptime, list of currently live streams with thumbnails

**Video Library**

- Drag & drop multi-upload (mp4/mkv/mov)
- Rename inline (file rename + DB update)
- Delete, duration + size + resolution detect (ffprobe)
- Search/filter

**Streams**

- "New Stream" form: name, RTMP URL (YouTube/Facebook/Twitch/custom), Stream Key, select videos (multi, drag to reorder playlist)
- Loop mode: infinite OR fixed hours (1–24h timer, baad ch auto-stop)
- Quality preset: 360p / 480p / 720p / 1080p — bitrate + resolution + fps
- Audio bitrate, video codec (libx264 default, copy mode for low CPU)
- Start / Stop / Restart buttons
- Per-stream live log (ffmpeg stderr) via Socket.IO
- Status: idle / starting / live / stopping / errored, with uptime

**Settings**

- Change admin key, default RTMP server presets, ffmpeg path

## Project Structure

```text
autolive-pro/
├── server/
│   ├── index.js            Express + Socket.IO entry
│   ├── auth.js             admin-key middleware
│   ├── db.js               sqlite schema + migrations
│   ├── routes/
│   │   ├── videos.js       upload, list, rename, delete
│   │   ├── streams.js      CRUD + start/stop
│   │   └── stats.js        CPU/RAM/disk
│   ├── streamer.js         StreamManager: spawn ffmpeg, concat-demuxer loop, timer, logs
│   └── ffmpeg.js           command builder (quality presets)
├── client/                 React + Vite + Tailwind (pink/purple)
│   ├── src/pages/          Login, Dashboard, Videos, Streams, StreamDetail, Settings
│   └── src/components/     StatCard, VideoTable, StreamCard, LogConsole, QualityPicker
├── media/                  uploaded videos (gitignored)
├── data/                   sqlite db + playlists (gitignored)
├── .env.example            ADMIN_KEY=jsk@1984, PORT=3000
├── ecosystem.config.js     PM2 config
├── install.sh              one-shot Oracle setup (apt install ffmpeg, node, pm2, clone, build, start, firewall rule for port 3000)
└── README.md               Oracle VPS deploy steps + ingress rule note
```

## Streaming Engine (key detail)

Playlist loop ffmpeg concat demuxer nal — videos re-encode na karn lai, default mode `-c copy` (CPU friendly for E2.1.Micro). Re-encode option v dindi a jdo source files different codecs/resolutions de hon. Loop infinite: `concat.txt` file likho saare videos nal, `-stream_loop -1` ya wrapper script jo crash te restart kre. Timer: `setTimeout(stopStream, hours*3600*1000)`.

```text
ffmpeg -re -stream_loop -1 -f concat -safe 0 -i playlist.txt \
  -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -vf scale=1280:720 -r 30 -g 60 \
  -c:a aac -b:a 128k -ar 44100 \
  -f flv rtmp://a.rtmp.youtube.com/live2/STREAM_KEY
```

`-c copy` preset jab user "Low CPU" choose kare (no transcoding, sirf remux to FLV).

## UI / Theme

- **Colors:** background `#1a0b2e` (deep purple-black), surfaces `#2d1b4e`, primary `#d946ef` (fuchsia), secondary `#a855f7` (purple), accent `#ec4899` (pink), text `#fae8ff`
- **Font:** Outfit (headings), Inter (body)
- **Vibe:** dark glassmorphism cards, soft pink/purple gradient accents, rounded-2xl, subtle glow on live indicators (pulsing pink dot for active streams)
- **Layout:** left sidebar nav (Dashboard / Videos / Streams / Settings), top bar with admin badge + logout

## Oracle VPS Deploy (README steps)

1. SSH in: `ssh ubuntu@152.67.2.219`
2. `curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash` — installs Node 20, ffmpeg, PM2, clones, builds client, starts under PM2
3. Oracle ingress rule: VCN → Security List → add ingress TCP port 3000 (0.0.0.0/0)
4. Ubuntu firewall: `sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT && sudo netfilter-persistent save`
5. Open `http://152.67.2.219:3000`, login with `jsk@1984`
6. (Optional) Caddy reverse proxy for HTTPS + domain

## Build Order

1. Scaffold repo structure, `package.json`, `.env.example`, `.gitignore`
2. Express server + sqlite schema + admin-key auth + login page
3. Video upload/list/rename/delete API + Multer
4. Stats API (CPU/RAM/disk/net) + Socket.IO setup
5. StreamManager: ffmpeg spawn, playlist builder, log streaming, timer auto-stop
6. Streams CRUD API + start/stop endpoints
7. React client: routing, Tailwind pink/purple theme, Login page
8. Dashboard page (stats cards + active streams)
9. Videos page (upload, table, rename, delete)
10. Streams page + StreamDetail (config form, quality picker, live log console, start/stop)
11. Settings page
12. `install.sh` + `ecosystem.config.js` + README with Oracle steps
13. Test build, polish UI

## Notes / Limitations

- E2.1.Micro (1 OCPU, 1 GB RAM, 0.48 Gbps) handle kar sakda **1–2 simultaneous 720p streams in `-c copy` mode**. Transcoding heavy hai — 1 stream 480p max recommended.
- Lovable da preview is panel nu actually chala nahi sakda (ffmpeg missing) — preview sirf UI dikhayega with mock data. Real run sirf Oracle VPS te.
- Saare videos VPS local disk te (free tier ~47 GB boot volume; chahide ta block volume attach kr lao).

Confirm karo te main build start krun.

JSK24Live da logo v add kr deo vdiaa ja system bnayo frontent panel te background sbh aapa ne vps te hi host krna a aapa nu public link mill ju panel da ta jo aapa kise v device to manage kr skiye k nhi?

&nbsp;