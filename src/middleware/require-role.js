function requireRole() {
  return (req, res, next) => next();
}

module.exports = {
  requireRole
};
