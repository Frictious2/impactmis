const userRepo = require("../repos/user.repo");

async function attachCurrentUser(req, res, next) {
  try {
    if (!req.session.userId) {
      req.currentUser = null;
      res.locals.currentUser = null;
      return next();
    }

    const user = await userRepo.findById(req.session.userId);

    if (!user || user.status !== "active") {
      req.session.destroy(() => {});
      req.currentUser = null;
      res.locals.currentUser = null;
      return next();
    }

    req.currentUser = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  attachCurrentUser
};
