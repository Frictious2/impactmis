const { body } = require("express-validator");

const loginValidator = [
  body("email").trim().isEmail().withMessage("Enter a valid email address."),
  body("password").isLength({ min: 1 }).withMessage("Password is required.")
];

module.exports = {
  loginValidator
};
