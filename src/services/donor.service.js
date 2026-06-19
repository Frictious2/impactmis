const donorRepo = require("../repos/donor.repo");
const organizationProfileRepo = require("../repos/organization-profile.repo");
const auditLogRepo = require("../repos/audit-log.repo");

async function getDashboardMetrics(tenantId) {
  return donorRepo.getDashboardMetrics(tenantId);
}

async function getOrganizationSummary(tenantId) {
  return organizationProfileRepo.findByTenantId(tenantId);
}

async function listProjects(tenantId, filters) {
  return donorRepo.listProjects(tenantId, filters);
}

async function findProjectById(tenantId, id) {
  return donorRepo.findProjectById(tenantId, id);
}

async function listApprovedReports(tenantId, filters) {
  return donorRepo.listApprovedReports(tenantId, filters);
}

async function findApprovedReportById(tenantId, id) {
  return donorRepo.findApprovedReportById(tenantId, id);
}

async function listReportAttachments(tenantId, reportId) {
  return donorRepo.listReportAttachments(tenantId, reportId);
}

async function listIndicators(tenantId, filters) {
  return donorRepo.listIndicators(tenantId, filters);
}

async function getProjectIndicators(tenantId, projectId) {
  return donorRepo.listProjectIndicators(tenantId, projectId);
}

async function getBeneficiarySummary(tenantId, filters) {
  return donorRepo.getBeneficiarySummary(tenantId, filters);
}

async function logDonorView({ tenantId, userId, action, entityType, entityId, metadata, ipAddress }) {
  return auditLogRepo.create({
    tenant_id: tenantId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    metadata_json: metadata || null,
    ip_address: ipAddress
  });
}

module.exports = {
  getDashboardMetrics,
  getOrganizationSummary,
  listProjects,
  findProjectById,
  listApprovedReports,
  findApprovedReportById,
  listReportAttachments,
  listIndicators,
  getProjectIndicators,
  getBeneficiarySummary,
  logDonorView
};
