const bcrypt = require("bcryptjs");
const userRepo = require("../repos/user.repo");

async function authenticate(email, password) {
  const matches = await userRepo.findByEmailCandidates(email.trim().toLowerCase());

  if (!matches.length) {
    return { ok: false, message: "Invalid email or password." };
  }

  const activeMatches = matches.filter((user) => user.status === "active");
  const developerMatch = activeMatches.find((user) => user.user_type === "developer");

  if (developerMatch) {
    const valid = await bcrypt.compare(password, developerMatch.password_hash);
    if (valid) {
      await userRepo.updateLastLogin(developerMatch.id);
      return { ok: true, user: developerMatch };
    }
  }

  if (activeMatches.length > 1) {
    return {
      ok: false,
      message:
        "Multiple tenant accounts share this email address. Contact your administrator for a unique login."
    };
  }

  const tenantMatch = activeMatches[0];

  if (!tenantMatch) {
    return { ok: false, message: "Your account is disabled." };
  }

  const valid = await bcrypt.compare(password, tenantMatch.password_hash);
  if (!valid) {
    return { ok: false, message: "Invalid email or password." };
  }

  await userRepo.updateLastLogin(tenantMatch.id);
  return { ok: true, user: tenantMatch };
}

module.exports = {
  authenticate
};
