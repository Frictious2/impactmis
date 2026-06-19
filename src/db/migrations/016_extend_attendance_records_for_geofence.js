module.exports = {
  id: "016_extend_attendance_records_for_geofence",
  up: async (db) => {
    const additions = [
      {
        column: "branch_id",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER staff_member_id,
          ADD CONSTRAINT fk_attendance_records_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
        `
      },
      {
        column: "capture_method",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN capture_method ENUM('self_check_in', 'manual_entry', 'bulk_entry') NOT NULL DEFAULT 'manual_entry' AFTER branch_id
        `
      },
      {
        column: "latitude",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN latitude DECIMAL(10,8) NULL AFTER location
        `
      },
      {
        column: "longitude",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN longitude DECIMAL(11,8) NULL AFTER latitude
        `
      },
      {
        column: "distance_from_branch_meters",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN distance_from_branch_meters DECIMAL(10,2) NULL AFTER longitude
        `
      },
      {
        column: "geofence_status",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN geofence_status ENUM('inside', 'outside', 'not_checked') NOT NULL DEFAULT 'not_checked' AFTER distance_from_branch_meters
        `
      },
      {
        column: "device_info",
        sql: `
          ALTER TABLE attendance_records
          ADD COLUMN device_info TEXT NULL AFTER geofence_status
        `
      }
    ];

    for (const addition of additions) {
      const [rows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'attendance_records'
            AND COLUMN_NAME = ?
        `,
        [addition.column]
      );

      if (!rows[0].total) {
        await db.query(addition.sql);
      }
    }
  }
};
