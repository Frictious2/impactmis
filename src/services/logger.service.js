const fs = require("fs");
const path = require("path");
const env = require("../config/env");

function ensureLogDir() {
  const logDir = path.resolve(process.cwd(), env.logDir);
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function redact(message) {
  return String(message || "")
    .replace(/(password|session_secret|csrf|token)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(env.dbPass ? new RegExp(env.dbPass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : /$a/, "[redacted]");
}

function write(level, message, metadata = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: redact(message),
    metadata
  });

  try {
    fs.appendFileSync(path.join(ensureLogDir(), "app.log"), `${line}\n`);
  } catch (error) {
    console.error("Failed to write app log:", error.message);
  }
}

function info(message, metadata) {
  write("info", message, metadata);
}

function error(message, metadata) {
  write("error", message, metadata);
}

module.exports = {
  info,
  error
};
