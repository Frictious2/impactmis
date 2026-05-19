module.exports = {
  id: "013_create_attendance_records",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        staff_member_id BIGINT UNSIGNED NOT NULL,
        attendance_date DATE NOT NULL,
        status ENUM('present', 'absent', 'late', 'excused', 'sick', 'on_leave') NOT NULL,
        check_in_time TIME NULL,
        check_out_time TIME NULL,
        hours_worked DECIMAL(5,2) NULL,
        location VARCHAR(255) NULL,
        notes TEXT NULL,
        entered_by BIGINT UNSIGNED NULL,
        approved_by BIGINT UNSIGNED NULL,
        approval_status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
        rejection_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_attendance_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendance_records_staff_member FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendance_records_entered_by FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_attendance_records_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_attendance_records_staff_date (tenant_id, staff_member_id, attendance_date),
        INDEX idx_attendance_records_filters (tenant_id, attendance_date, approval_status, status)
      )
    `);
  }
};
