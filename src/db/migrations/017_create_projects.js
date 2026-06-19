module.exports = {
  id: "017_create_projects",
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        project_code VARCHAR(50) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        project_description TEXT NOT NULL,
        branch_id BIGINT UNSIGNED NULL,
        project_manager_id BIGINT UNSIGNED NULL,
        donor_name VARCHAR(255) NULL,
        budget DECIMAL(15,2) NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') NOT NULL DEFAULT 'planning',
        completion_percentage TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_by BIGINT UNSIGNED NOT NULL,
        updated_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_projects_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_projects_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
        CONSTRAINT fk_projects_manager FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_projects_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE KEY uq_projects_code_tenant (tenant_id, project_code),
        INDEX idx_projects_tenant_status (tenant_id, status),
        INDEX idx_projects_tenant_branch (tenant_id, branch_id),
        INDEX idx_projects_tenant_manager (tenant_id, project_manager_id)
      )
    `);
  }
};
