const express = require("express");
const authController = require("../controllers/auth.controller");
const { loginValidator } = require("../validators/auth.validator");

const router = express.Router();

router.get("/login", authController.showLogin);
router.post("/login", loginValidator, authController.login);
router.post("/logout", authController.logout);

module.exports = router;
