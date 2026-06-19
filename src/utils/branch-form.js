function buildBranchFormData(input = {}) {
  return {
    branch_code: input.branch_code || "",
    name: input.name || "",
    address: input.address || "",
    city: input.city || "",
    district: input.district || "",
    country: input.country || "Sierra Leone",
    latitude: input.latitude || "",
    longitude: input.longitude || "",
    geofence_radius_meters: input.geofence_radius_meters || 100,
    contact_name: input.contact_name || "",
    contact_phone: input.contact_phone || "",
    status: input.status || "active"
  };
}

function buildBranchFilters(query = {}) {
  return {
    search: query.search || "",
    status: query.status || ""
  };
}

function getBranchStatusOptions() {
  return [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" }
  ];
}

module.exports = {
  buildBranchFormData,
  buildBranchFilters,
  getBranchStatusOptions
};
