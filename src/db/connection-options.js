const env = require("../config/env");

function getBaseConnectionOptions(includeDatabase = true) {
  const options = {
    host: env.dbHost,
    user: env.dbUser,
    password: env.dbPass,
    port: env.dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    multipleStatements: false
  };

  if (includeDatabase) {
    options.database = env.dbName;
  }

  return options;
}

module.exports = {
  getBaseConnectionOptions
};
