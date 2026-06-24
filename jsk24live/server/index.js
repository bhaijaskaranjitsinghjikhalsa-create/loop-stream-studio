require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server: IOServer } = require('socket.io');

const { requireAuth, setAuthCookie, clearAuthCookie, checkAuthCookie } = require('./auth');
const db = require('./db');
const StreamManager = require('./streamer');
const videosRouter = require('./routes/videos');
const buildStreamsRouter = require('./routes/streams');
const statsRouter = require('./routes/stats');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || 'jsk@1984';

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: false } });
const streamManager = new StreamManager(io);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public')));

// ----- auth -----
app.get('/login', (req, res) => {
  if (checkAuthCookie(req)) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { key } = req.body;
  if (typeof key === 'string' && key === ADMIN_KEY) {
    setAuthCookie(res);
    return res.redirect('/');
  }
  res.render('login', { error: 'Invalid admin key' });
});

app.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.redirect('/login');
});

// ----- pages (auth required) -----
app.get('/', requireAuth, (req, res) => res.render('dashboard', { page: 'dashboard' }));
app.get('/videos', requireAuth, (req, res) => res.render('videos', { page: 'videos' }));
app.get('/streams', requireAuth, (req, res) => res.render('streams', { page: 'streams' }));
app.get('/streams/new', requireAuth, (req, res) =>
  res.render('stream_edit', { page: 'streams', streamId: null })
);
app.get('/streams/:id', requireAuth, (req, res) =>
  res.render('stream_detail', { page: 'streams', streamId: req.params.id })
);
app.get('/streams/:id/edit', requireAuth, (req, res) =>
  res.render('stream_edit', { page: 'streams', streamId: req.params.id })
);

// ----- api -----
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/videos', requireAuth, videosRouter);
app.use('/api/streams', requireAuth, buildStreamsRouter(streamManager));

// ----- socket.io auth -----
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  const fakeReq = { cookies };
  if (checkAuthCookie(fakeReq)) return next();
  next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  socket.on('watch-stream', (id) => {
    socket.join(`stream:${id}`);
    const s = streamManager.status(parseInt(id, 10));
    socket.emit('snapshot', { id, ...s });
  });
  socket.on('unwatch-stream', (id) => socket.leave(`stream:${id}`));
});

// ----- error handling -----
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message });
});

process.on('SIGINT', () => {
  console.log('\nShutting down — stopping streams...');
  streamManager.stopAll();
  setTimeout(() => process.exit(0), 1500);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  JSK24Live running on http://0.0.0.0:${PORT}`);
  console.log(`  Admin key: ${ADMIN_KEY === 'jsk@1984' ? '(default jsk@1984)' : '(custom)'}\n`);
});
