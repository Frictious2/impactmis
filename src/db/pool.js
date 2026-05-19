const mysql = require("mysql2/promise");
const { getBaseConnectionOptions } = require("./connection-options");

const pool = mysql.createPool(getBaseConnectionOptions(true));

module.exports = pool;
