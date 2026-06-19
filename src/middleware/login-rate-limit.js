const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function getKey(req) {
  return `${req.ip}:${String(req.body?.email || "").toLowerCase()}`;
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = getKey(req);
  const record = attempts.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  attempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).render("layouts/auth-layout", {
      pageTitle: "Login",
      contentPartial: "../pages/auth/login",
      formData: { email: req.body?.email || "" },
      authError: "Too many login attempts. Please wait a few minutes and try again."
    });
  }

  return next();
}

function clearLoginAttempts(req) {
  attempts.delete(getKey(req));
}

module.exports = {
  loginRateLimit,
  clearLoginAttempts
};
