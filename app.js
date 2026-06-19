const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const helmet = require("helmet");
const morgan = require("morgan");
const methodOverride = require("method-override");

const env = require("./src/config/env");
const authRoutes = require("./src/routes/auth.routes");
const developerRoutes = require("./src/routes/developer.routes");
const donorRoutes = require("./src/routes/donor.routes");
const tenantRoutes = require("./src/routes/tenant.routes");
const { attachCurrentUser } = require("./src/middleware/attach-current-user");
const { attachTenantContext } = require("./src/middleware/attach-tenant-context");
const { attachNotificationCounts } = require("./src/middleware/attach-notification-counts");
const { csrfProtection } = require("./src/middleware/csrf-protection");
const { forcePasswordChange } = require("./src/middleware/force-password-change");

const app = express();
if (env.isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(morgan(env.isProduction ? "combined" : "dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use(flash());
app.use(csrfProtection);
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.appName = "ImpactMIS";
  res.locals.currentYear = new Date().getFullYear();
  res.locals.currentPath = req.path;
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  next();
});

app.use(attachCurrentUser);
app.use(attachTenantContext);
app.use(attachNotificationCounts);
app.use(forcePasswordChange);

app.use("/", authRoutes);
app.use("/developer", developerRoutes);
app.use("/donor", donorRoutes);
app.use("/", tenantRoutes);

app.use((req, res) => {
  res.status(404).render("pages/errors/404", {
    pageTitle: "Page Not Found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render("pages/errors/500", {
    pageTitle: "Server Error",
    errorMessage: env.isProduction ? null : err.message
  });
});

app.listen(env.port, () => {
  console.log(`ImpactMIS listening on port ${env.port}`);
});
