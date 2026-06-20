const pool = require("../db/pool");
const measurementRepo = require("../repos/measurement.repo");
const indicatorRepo = require("../repos/indicator.repo");
const auditLogRepo = require("../repos/audit-log.repo");

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function calculateProgress(indicator, measurements = []) {
  const latestBaseline = [...measurements].reverse().find((row) => row.measurement_type === "baseline");
  const latestTarget = [...measurements].reverse().find((row) => row.measurement_type === "target");
  const latestEndline = [...measurements].reverse().find((row) => row.measurement_type === "endline");
  const latestPeriodic = [...measurements].reverse().find((row) => row.measurement_type === "periodic");
  const baseline = Number(latestBaseline?.value || 0);
  const target = Number(latestTarget?.value ?? indicator.target_value ?? 0);
  const current = Number(latestEndline?.value ?? latestPeriodic?.value ?? indicator.current_value ?? 0);
  const denominator = target - baseline;
  const progress = denominator === 0 ? (current >= target ? 100 : 0) : ((current - baseline) / denominator) * 100;
  return {
    baseline,
    target,
    current,
    endline: latestEndline ? Number(latestEndline.value || 0) : null,
    progressPercentage: Math.max(0, Math.min(100, Number(progress.toFixed(2)))),
    onTrack: target === 0 || current >= target
  };
}

async function listMeasurements(tenantId, indicatorId) {
  const indicator = await indicatorRepo.findIndicatorById(tenantId, indicatorId);
  if (!indicator) throw appError("Indicator was not found.", 404);
  const measurements = await measurementRepo.listMeasurements(tenantId, indicatorId);
  return { indicator, measurements, progress: calculateProgress(indicator, measurements) };
}

async function addMeasurement(tenantId, indicatorId, payload, userId, ipAddress) {
  if (!["baseline", "target", "periodic", "endline"].includes(payload.measurement_type)) throw appError("Invalid measurement type.");
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const indicator = await indicatorRepo.findIndicatorById(tenantId, indicatorId, db);
    if (!indicator) throw appError("Indicator was not found.", 404);
    const measurement = await measurementRepo.addMeasurement(
      tenantId,
      indicatorId,
      {
        measurement_type: payload.measurement_type,
        measurement_date: payload.measurement_date,
        value: Number(payload.value || 0),
        comments: payload.comments || null
      },
      userId,
      db
    );
    await auditLogRepo.create(
      {
        tenant_id: tenantId,
        user_id: userId,
        action: "measurement.created",
        entity_type: "indicator_measurement",
        entity_id: String(measurement.id),
        metadata_json: { indicator_id: indicator.id, measurement_id: measurement.id, measurement_type: measurement.measurement_type },
        ip_address: ipAddress
      },
      db
    );
    await db.commit();
    return measurement;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { addMeasurement, listMeasurements, calculateProgress };
