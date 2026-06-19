function parseModules(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  if (typeof value === "object") {
    return value;
  }

  return null;
}

function hasModuleAccess(modules, moduleCode) {
  if (!modules) {
    return true;
  }

  if (Array.isArray(modules)) {
    return modules.includes(moduleCode);
  }

  if (typeof modules === "object") {
    if (!Object.prototype.hasOwnProperty.call(modules, moduleCode)) {
      return false;
    }
    const rawValue = modules[moduleCode];
    return !(
      rawValue === false ||
      rawValue === "false" ||
      rawValue === 0 ||
      rawValue === "0" ||
      rawValue === "disabled" ||
      rawValue === "off"
    );
  }

  return true;
}

function requireModuleAccess(moduleCode) {
  return (req, res, next) => {
    if (!req.currentUser || req.currentUser.user_type === "developer") {
      return next();
    }

    const modules = parseModules(req.activeLicense?.modules_json);
    if (hasModuleAccess(modules, moduleCode)) {
      return next();
    }

    req.flash("error", `Your current license does not include access to the ${moduleCode} module.`);
    return res.redirect("/dashboard");
  };
}

module.exports = {
  requireModuleAccess
};
