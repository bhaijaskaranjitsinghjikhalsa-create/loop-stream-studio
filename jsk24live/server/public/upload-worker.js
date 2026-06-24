// SharedWorker — uploads continue across page navigations within the same origin.
// Pages connect via new SharedWorker('/static/upload-worker.js') and exchange
// JSON messages: { type: 'start' | 'status' | 'cancel', ... }
const ports = new Set();
let nextId = 1;
const jobs = new Map(); // id -> { name, total, loaded, status, error, xhr }

function broadcast(msg) {
  for (const p of ports) {
    try { p.postMessage(msg); } catch (_) {}
  }
}

function snapshot() {
  return Array.from(jobs.entries()).map(([id, j]) => ({
    id, name: j.name, total: j.total, loaded: j.loaded, status: j.status, error: j.error || null,
  }));
}

function sendList() { broadcast({ type: 'list', jobs: snapshot() }); }

function startUpload(files) {
  // files: Array<File>
  const id = nextId++;
  const fd = new FormData();
  for (const f of files) fd.append('videos', f);
  const total = files.reduce((s, f) => s + f.size, 0);
  const name = files.length === 1 ? files[0].name : `${files.length} files`;
  const job = { name, total, loaded: 0, status: 'uploading', error: null, xhr: null };
  jobs.set(id, job);

  const xhr = new XMLHttpRequest();
  job.xhr = xhr;
  xhr.open('POST', '/api/videos/upload');
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      job.loaded = e.loaded;
      broadcast({ type: 'progress', id, loaded: e.loaded, total: e.total });
    }
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      job.status = 'done';
      job.loaded = job.total;
      broadcast({ type: 'done', id });
    } else {
      job.status = 'error';
      job.error = `HTTP ${xhr.status}`;
      broadcast({ type: 'error', id, error: job.error });
    }
    setTimeout(() => { jobs.delete(id); sendList(); }, 8000);
  };
  xhr.onerror = () => {
    job.status = 'error';
    job.error = 'Network error';
    broadcast({ type: 'error', id, error: job.error });
    setTimeout(() => { jobs.delete(id); sendList(); }, 8000);
  };
  xhr.send(fd);
  sendList();
  return id;
}

onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);
  port.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.type === 'start' && Array.isArray(m.files)) {
      startUpload(m.files);
    } else if (m.type === 'list') {
      port.postMessage({ type: 'list', jobs: snapshot() });
    } else if (m.type === 'cancel' && m.id) {
      const j = jobs.get(m.id);
      if (j && j.xhr) { try { j.xhr.abort(); } catch (_) {} jobs.delete(m.id); sendList(); }
    }
  };
  port.start && port.start();
  port.postMessage({ type: 'list', jobs: snapshot() });
};
