const express = require('express');
const si = require('systeminformation');
const os = require('os');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const MEDIA_DIR = path.join(__dirname, '..', '..', 'media');

let lastNet = { rx: 0, tx: 0, t: Date.now() };

router.get('/', async (_req, res) => {
  try {
    const [cpu, mem, fsSize, net] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize().catch(() => []),
      si.networkStats().catch(() => []),
    ]);

    const rootFs = (fsSize || []).find((d) => d.mount === '/') || fsSize[0] || {};
    const n = (net && net[0]) || {};
    const now = Date.now();
    const dt = Math.max(1, (now - lastNet.t) / 1000);
    const rxBps = Math.max(0, (n.rx_bytes || 0) - lastNet.rx) / dt;
    const txBps = Math.max(0, (n.tx_bytes || 0) - lastNet.tx) / dt;
    lastNet = { rx: n.rx_bytes || 0, tx: n.tx_bytes || 0, t: now };

    let mediaSize = 0;
    try {
      for (const f of fs.readdirSync(MEDIA_DIR)) {
        mediaSize += fs.statSync(path.join(MEDIA_DIR, f)).size;
      }
    } catch (_) {}

    res.json({
      cpu: { load: cpu.currentLoad || 0, cores: os.cpus().length },
      mem: { total: mem.total, used: mem.active, free: mem.available },
      disk: { total: rootFs.size || 0, used: rootFs.used || 0, mount: rootFs.mount || '/' },
      media_size: mediaSize,
      net: { rx_bps: rxBps, tx_bps: txBps },
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
