const mysql = require("mysql2/promise");
const env = require("../config/env");
const { getBaseConnectionOptions } = require("./connection-options");

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection(getBaseConnectionOptions(false));

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

module.exports = {
  ensureDatabaseExists
};
