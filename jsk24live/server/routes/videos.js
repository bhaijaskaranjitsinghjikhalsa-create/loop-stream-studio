const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { probe } = require('../ffmpeg');

const router = express.Router();
const MEDIA_DIR = path.join(__dirname, '..', '..', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

function safeName(name) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 200) || 'video.mp4';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const clean = safeName(file.originalname);
    cb(null, `${ts}_${clean}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(mp4|mkv|mov|flv|ts|webm|m4v)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported video format'), ok);
  },
});

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/upload', upload.array('videos', 20), async (req, res) => {
  const out = [];
  for (const f of req.files || []) {
    const display = (req.body.display_name && req.files.length === 1)
      ? req.body.display_name
      : f.originalname.replace(/\.[^.]+$/, '');
    try {
      const meta = await probe(path.join(MEDIA_DIR, f.filename));
      const info = db
        .prepare(
          'INSERT INTO videos (filename, display_name, size, duration, width, height) VALUES (?,?,?,?,?,?)'
        )
        .run(f.filename, display, f.size, meta.duration, meta.width, meta.height);
      out.push({ id: info.lastInsertRowid, filename: f.filename, display_name: display, ...meta });
    } catch (err) {
      out.push({ error: err.message, filename: f.filename });
    }
  }
  res.json({ uploaded: out });
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { display_name } = req.body;
  if (!display_name || !display_name.trim()) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE videos SET display_name=? WHERE id=?').run(display_name.trim(), id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT filename FROM videos WHERE id=?').get(id);
  if (row) {
    try { fs.unlinkSync(path.join(MEDIA_DIR, row.filename)); } catch (_) {}
    db.prepare('DELETE FROM videos WHERE id=?').run(id);
  }
  res.json({ ok: true });
});

module.exports = router;
