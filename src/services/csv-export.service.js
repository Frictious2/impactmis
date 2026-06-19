function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column.key])).join(","));
  return [header, ...body].join("\r\n");
}

function filename(reportName, date = new Date()) {
  const slug = String(reportName || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `impactmis-${slug}-${stamp}.csv`;
}

function sendCsv(res, reportName, columns, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename(reportName)}"`);
  return res.send(toCsv(columns, rows));
}

module.exports = {
  escapeCsv,
  toCsv,
  filename,
  sendCsv
};
