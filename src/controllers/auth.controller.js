const { validationResult } = require("express-validator");
const authService = require("../services/auth.service");

function showLogin(req, res) {
  if (req.currentUser) {
    if (req.currentUser.user_type === "developer") {
      return res.redirect("/developer/dashboard");
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

    req.session.userId = result.user.id;
    req.flash("success", `Welcome back, ${result.user.full_name}.`);

    if (result.user.user_type === "developer") {
      return res.redirect("/developer/dashboard");
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
  logout
};
