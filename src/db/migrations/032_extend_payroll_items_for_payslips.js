async function columnExists(db, tableName, columnName) {
  const [rows] = await db.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return Boolean(rows[0]);
}

async function indexExists(db, tableName, indexName) {
  const [rows] = await db.query(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  return Boolean(rows[0]);
}

module.exports = {
  id: "032_extend_payroll_items_for_payslips",
  up: async (db) => {
    if (!(await columnExists(db, "payroll_items", "payslip_reference"))) {
      await db.query("ALTER TABLE payroll_items ADD COLUMN payslip_reference VARCHAR(100) NULL AFTER staff_name");
    }

    if (!(await columnExists(db, "payroll_items", "payment_status"))) {
      await db.query(
        "ALTER TABLE payroll_items ADD COLUMN payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER notes"
      );
    }

    if (!(await columnExists(db, "payroll_items", "payment_date"))) {
      await db.query("ALTER TABLE payroll_items ADD COLUMN payment_date DATE NULL AFTER payment_status");
    }

    if (!(await indexExists(db, "payroll_items", "uq_payroll_items_payslip_ref"))) {
      await db.query("ALTER TABLE payroll_items ADD UNIQUE KEY uq_payroll_items_payslip_ref (tenant_id, payslip_reference)");
    }
  }
};
