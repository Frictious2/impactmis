module.exports = {
  id: "018_create_project_assignments",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_assignments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        staff_member_id BIGINT UNSIGNED NOT NULL,
        assignment_role VARCHAR(150) NOT NULL,
        assigned_date DATE NOT NULL,
        status ENUM('active', 'completed', 'removed') NOT NULL DEFAULT 'active',
        created_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_project_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_assignments_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_assignments_staff FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE KEY uq_project_staff_status (tenant_id, project_id, staff_member_id, status),
        INDEX idx_project_assignments_project_status (tenant_id, project_id, status)
      )
    `);
  }
};
