const crypto = require('crypto');

function signCookie(value, secret) {
  const sig = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${sig}`;
}

function verifyCookie(signed, secret) {
  if (!signed || typeof signed !== 'string') return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
  try {
    if (
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return value;
    }
  } catch (_) {}
  return null;
}

function requireAuth(req, res, next) {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  const raw = req.cookies && req.cookies.jsk_auth;
  const value = verifyCookie(raw, secret);
  if (value === 'ok') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return res.redirect('/login');
}

function setAuthCookie(res) {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  const signed = signCookie('ok', secret);
  res.cookie('jsk_auth', signed, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('jsk_auth');
}

function checkAuthCookie(req) {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  return verifyCookie(req.cookies && req.cookies.jsk_auth, secret) === 'ok';
}

module.exports = { requireAuth, setAuthCookie, clearAuthCookie, checkAuthCookie };
