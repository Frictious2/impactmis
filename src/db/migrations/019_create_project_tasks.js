module.exports = {
  id: "019_create_project_tasks",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        assigned_staff_id BIGINT UNSIGNED NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        due_date DATE NULL,
        priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
        status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
        completion_percentage TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_by BIGINT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_project_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_tasks_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff_members(id) ON DELETE SET NULL,
        CONSTRAINT fk_project_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_project_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
        INDEX idx_project_tasks_project_status (tenant_id, project_id, status),
        INDEX idx_project_tasks_due_date (tenant_id, due_date)
      )
    `);
  }
};
