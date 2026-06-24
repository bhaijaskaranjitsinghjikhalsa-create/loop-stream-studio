const express = require('express');
const db = require('../db');
const { QUALITY_PRESETS } = require('../ffmpeg');

module.exports = function buildStreamsRouter(manager) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM streams ORDER BY created_at DESC').all();
    const out = rows.map((r) => ({
      ...r,
      video_ids: JSON.parse(r.video_ids || '[]'),
      running: manager.isActive(r.id),
    }));
    res.json(out);
  });

  router.get('/presets', (_req, res) => {
    res.json(Object.keys(QUALITY_PRESETS).map((k) => ({ key: k, label: QUALITY_PRESETS[k].label })));
  });

  router.get('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const r = db.prepare('SELECT * FROM streams WHERE id=?').get(id);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json({
      ...r,
      video_ids: JSON.parse(r.video_ids || '[]'),
      running: manager.isActive(r.id),
      runtime: manager.status(id),
    });
  });

  router.post('/', (req, res) => {
    const { name, rtmp_url, stream_key, quality, video_ids, loop_hours } = req.body;
    if (!name || !rtmp_url || !stream_key) return res.status(400).json({ error: 'name, rtmp_url, stream_key required' });
    const q = QUALITY_PRESETS[quality] ? quality : 'copy';
    const vids = Array.isArray(video_ids) ? video_ids.map((x) => parseInt(x, 10)).filter(Boolean) : [];
    const lh = Math.max(0, Math.min(168, parseInt(loop_hours, 10) || 0));
    const info = db
      .prepare(
        'INSERT INTO streams (name, rtmp_url, stream_key, quality, video_ids, loop_hours) VALUES (?,?,?,?,?,?)'
      )
      .run(name.trim(), rtmp_url.trim(), stream_key.trim(), q, JSON.stringify(vids), lh);
    res.json({ id: info.lastInsertRowid });
  });

  router.put('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const exists = db.prepare('SELECT id FROM streams WHERE id=?').get(id);
    if (!exists) return res.status(404).json({ error: 'not found' });
    if (manager.isActive(id)) return res.status(400).json({ error: 'stop the stream before editing' });
    const { name, rtmp_url, stream_key, quality, video_ids, loop_hours } = req.body;
    const q = QUALITY_PRESETS[quality] ? quality : 'copy';
    const vids = Array.isArray(video_ids) ? video_ids.map((x) => parseInt(x, 10)).filter(Boolean) : [];
    const lh = Math.max(0, Math.min(168, parseInt(loop_hours, 10) || 0));
    db.prepare(
      'UPDATE streams SET name=?, rtmp_url=?, stream_key=?, quality=?, video_ids=?, loop_hours=? WHERE id=?'
    ).run(name.trim(), rtmp_url.trim(), stream_key.trim(), q, JSON.stringify(vids), lh, id);
    res.json({ ok: true });
  });

  router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (manager.isActive(id)) manager.stop(id);
    db.prepare('DELETE FROM streams WHERE id=?').run(id);
    res.json({ ok: true });
  });

  router.post('/:id/start', (req, res) => {
    try {
      manager.start(parseInt(req.params.id, 10));
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/:id/stop', (req, res) => {
    manager.stop(parseInt(req.params.id, 10));
    res.json({ ok: true });
  });

  router.get('/:id/logs', (req, res) => {
    res.json(manager.status(parseInt(req.params.id, 10)));
  });

  return router;
};
