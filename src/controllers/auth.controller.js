const { validationResult } = require("express-validator");
const authService = require("../services/auth.service");
const auditLogRepo = require("../repos/audit-log.repo");
const { clearLoginAttempts } = require("../middleware/login-rate-limit");

function showLogin(req, res) {
  if (req.currentUser) {
    if (req.currentUser.must_change_password) {
      return res.redirect("/change-password");
    }

    if (req.currentUser.user_type === "developer") {
      return res.redirect("/developer/dashboard");
    }

    if (req.currentUser.role === "Donor") {
      return res.redirect("/donor/dashboard");
    }

    return res.redirect("/dashboard");
  }

  return res.render("layouts/auth-layout", {
    pageTitle: "Login",
    contentPartial: "../pages/auth/login",
    formData: {
      email: ""
    },
    authError: null
  });
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("layouts/auth-layout", {
        pageTitle: "Login",
        contentPartial: "../pages/auth/login",
        formData: {
          email: req.body.email || ""
        },
        validationErrors: errors.array(),
        authError: null
      });
    }

    const result = await authService.authenticate(req.body.email, req.body.password);

    if (!result.ok) {
      return res.status(401).render("layouts/auth-layout", {
        pageTitle: "Login",
        contentPartial: "../pages/auth/login",
        formData: {
          email: req.body.email || ""
        },
        authError: result.message
      });
    }

    clearLoginAttempts(req);
    return req.session.regenerate(async (sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      try {
        req.session.userId = result.user.id;
        req.flash("success", `Welcome back, ${result.user.full_name}.`);

        if (result.user.must_change_password) {
          return res.redirect("/change-password");
        }

        if (result.user.user_type === "developer") {
          return res.redirect("/developer/dashboard");
        }

        if (result.user.role === "Donor") {
          await auditLogRepo.create({
            tenant_id: result.user.tenant_id,
            user_id: result.user.id,
            action: "donor.login",
            entity_type: "user",
            entity_id: String(result.user.id),
            metadata_json: {
              email: result.user.email,
              role: result.user.role
            },
            ip_address: req.ip
          });
          return res.redirect("/donor/dashboard");
        }

        return res.redirect("/dashboard");
      } catch (error) {
        return next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

function showChangePassword(req, res) {
  return res.render("layouts/auth-layout", {
    pageTitle: "Change Password",
    contentPartial: "../pages/auth/change-password",
    validationErrors: [],
    authError: null
  });
}

async function changePassword(req, res, next) {
  try {
    if (!req.currentUser) {
      req.flash("error", "Please log in to continue.");
      return res.redirect("/login");
    }

    const validationErrors = [];
    if (!req.body.current_password) {
      validationErrors.push({ msg: "Current password is required." });
    }
    if (!req.body.new_password || req.body.new_password.length < 8) {
      validationErrors.push({ msg: "New password must be at least 8 characters long." });
    }
    if (req.body.new_password !== req.body.confirm_password) {
      validationErrors.push({ msg: "Password confirmation does not match." });
    }

    if (validationErrors.length) {
      return res.status(422).render("layouts/auth-layout", {
        pageTitle: "Change Password",
        contentPartial: "../pages/auth/change-password",
        validationErrors,
        authError: null
      });
    }

    const result = await authService.changePassword(
      req.currentUser.id,
      req.body.current_password,
      req.body.new_password
    );

    if (!result.ok) {
      return res.status(422).render("layouts/auth-layout", {
        pageTitle: "Change Password",
        contentPartial: "../pages/auth/change-password",
        validationErrors: [],
        authError: result.message
      });
    }

    req.flash("success", "Password changed successfully.");
    if (req.currentUser.user_type === "developer") {
      return res.redirect("/developer/dashboard");
    }
    if (req.currentUser.role === "Donor") {
      return res.redirect("/donor/dashboard");
    }
    return res.redirect("/dashboard");
  } catch (error) {
    return next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
}

module.exports = {
  showLogin,
  login,
  showChangePassword,
  changePassword,
  logout
};
