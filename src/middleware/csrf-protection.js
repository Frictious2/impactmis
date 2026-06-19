const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function ensureCsrfToken(req) {
  if (!req.session) {
    return null;
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

function appendTokenToAction(match, attrs, token) {
  const actionMatch = attrs.match(/\saction=(["'])(.*?)\1/i);
  let nextAttrs = attrs;

  if (actionMatch) {
    const quote = actionMatch[1];
    const action = actionMatch[2];
    if (!/[?&]_csrf=/.test(action)) {
      const separator = action.includes("?") ? "&" : "?";
      nextAttrs = attrs.replace(actionMatch[0], ` action=${quote}${action}${separator}_csrf=${token}${quote}`);
    }
  }

  return `${match.replace(attrs, nextAttrs)}<input type="hidden" name="_csrf" value="${token}">`;
}

function injectCsrfTokens(html, token) {
  if (!token || typeof html !== "string" || !html.includes("<form")) {
    return html;
  }

  return html.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
    if (!/\bmethod=(["'])post\1/i.test(attrs)) {
      return match;
    }

    if (match.includes('name="_csrf"')) {
      return match;
    }

    return appendTokenToAction(match, attrs, token);
  });
}

function csrfProtection(req, res, next) {
  const token = ensureCsrfToken(req);
  res.locals.csrfToken = token;

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const contentType = String(res.get("Content-Type") || "");
    if (contentType.includes("text/html") || (typeof body === "string" && body.includes("<html"))) {
      return originalSend(injectCsrfTokens(body, token));
    }
    return originalSend(body);
  };

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const submittedToken = req.body?._csrf || req.query?._csrf || req.get("x-csrf-token");
  const submittedBuffer = Buffer.from(String(submittedToken || ""));
  const tokenBuffer = Buffer.from(String(token || ""));
  if (
    submittedToken &&
    token &&
    submittedBuffer.length === tokenBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, tokenBuffer)
  ) {
    return next();
  }

  req.flash("error", "Your session security token expired. Please try again.");
  return res.status(403).render("pages/errors/500", {
    pageTitle: "Security Check Failed",
    errorMessage: "Invalid or missing CSRF token."
  });
}

module.exports = {
  csrfProtection
};
