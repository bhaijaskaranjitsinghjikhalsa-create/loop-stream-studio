const fs = require('fs');
const path = require('path');
const { FFMPEG, buildArgs } = require('./ffmpeg');
const { spawn } = require('child_process');
const db = require('./db');

const MEDIA_DIR = path.join(__dirname, '..', 'media');
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYLIST_DIR = path.join(DATA_DIR, 'playlists');
if (!fs.existsSync(PLAYLIST_DIR)) fs.mkdirSync(PLAYLIST_DIR, { recursive: true });

const MAX_LOG_LINES = 400;

class StreamManager {
  constructor(io) {
    this.io = io;
    this.active = new Map(); // streamId -> { proc, startedAt, timer, logs }
    // Reset any stale 'live' rows from previous crash
    db.prepare("UPDATE streams SET status='idle', started_at=NULL WHERE status IN ('live','starting','stopping')").run();
  }

  buildPlaylist(streamId, videoIds) {
    const rows = videoIds
      .map((id) => db.prepare('SELECT filename FROM videos WHERE id=?').get(id))
      .filter(Boolean);
    if (!rows.length) throw new Error('No valid videos in playlist');
    const lines = rows.map((r) => {
      const full = path.resolve(MEDIA_DIR, r.filename).replace(/'/g, "'\\''");
      return `file '${full}'`;
    });
    const file = path.join(PLAYLIST_DIR, `stream_${streamId}.txt`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return file;
  }

  isActive(id) {
    return this.active.has(id);
  }

  status(id) {
    const a = this.active.get(id);
    if (!a) return { running: false };
    return {
      running: true,
      startedAt: a.startedAt,
      uptime: Math.floor((Date.now() - a.startedAt) / 1000),
      logs: a.logs.slice(-100),
    };
  }

  start(streamId) {
    if (this.active.has(streamId)) throw new Error('Already running');
    const s = db.prepare('SELECT * FROM streams WHERE id=?').get(streamId);
    if (!s) throw new Error('Stream not found');
    const videoIds = JSON.parse(s.video_ids || '[]');
    if (!videoIds.length) throw new Error('Playlist is empty — add videos first');
    if (!s.rtmp_url || !s.stream_key) throw new Error('RTMP URL and stream key required');

    const playlist = this.buildPlaylist(streamId, videoIds);
    const args = buildArgs({
      playlistFile: playlist,
      quality: s.quality || 'copy',
      rtmpUrl: s.rtmp_url,
      streamKey: s.stream_key,
    });

    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const startedAt = Date.now();
    const logs = [];
    const entry = { proc, startedAt, timer: null, logs };

    const pushLog = (line) => {
      const trimmed = line.toString().replace(/\r/g, '').split('\n').filter(Boolean);
      for (const l of trimmed) {
        logs.push({ t: Date.now(), m: l });
        if (logs.length > MAX_LOG_LINES) logs.shift();
        this.io.to(`stream:${streamId}`).emit('log', { id: streamId, line: l });
      }
    };
    proc.stdout.on('data', pushLog);
    proc.stderr.on('data', pushLog);

    proc.on('exit', (code, signal) => {
      pushLog(`\n[ffmpeg exited code=${code} signal=${signal || '-'}]`);
      this.active.delete(streamId);
      if (entry.timer) clearTimeout(entry.timer);
      db.prepare("UPDATE streams SET status='idle', started_at=NULL WHERE id=?").run(streamId);
      this.io.emit('stream-status', { id: streamId, status: 'idle' });
    });

    proc.on('error', (err) => {
      pushLog(`[spawn error] ${err.message}`);
    });

    if (s.loop_hours && s.loop_hours > 0) {
      entry.timer = setTimeout(() => {
        pushLog(`[auto-stop] ${s.loop_hours}h timer reached`);
        this.stop(streamId);
      }, s.loop_hours * 3600 * 1000);
    }

    this.active.set(streamId, entry);
    db.prepare("UPDATE streams SET status='live', started_at=? WHERE id=?").run(startedAt, streamId);
    this.io.emit('stream-status', { id: streamId, status: 'live', startedAt });
  }

  stop(streamId) {
    const a = this.active.get(streamId);
    if (!a) {
      db.prepare("UPDATE streams SET status='idle', started_at=NULL WHERE id=?").run(streamId);
      return;
    }
    db.prepare("UPDATE streams SET status='stopping' WHERE id=?").run(streamId);
    this.io.emit('stream-status', { id: streamId, status: 'stopping' });
    try {
      a.proc.kill('SIGINT');
    } catch (_) {}
    setTimeout(() => {
      if (this.active.has(streamId)) {
        try { a.proc.kill('SIGKILL'); } catch (_) {}
      }
    }, 5000);
  }

  stopAll() {
    for (const id of this.active.keys()) this.stop(id);
  }
}

module.exports = StreamManager;
