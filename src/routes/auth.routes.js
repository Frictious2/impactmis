const express = require("express");
const authController = require("../controllers/auth.controller");
const { loginValidator } = require("../validators/auth.validator");
const { requireAuth } = require("../middleware/require-auth");
const { loginRateLimit } = require("../middleware/login-rate-limit");

const router = express.Router();

router.get("/login", authController.showLogin);
router.post("/login", loginRateLimit, loginValidator, authController.login);
router.get("/change-password", requireAuth, authController.showChangePassword);
router.post("/change-password", requireAuth, authController.changePassword);
router.post("/logout", authController.logout);

module.exports = router;
