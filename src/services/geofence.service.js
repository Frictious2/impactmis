function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistance(branchLatitude, branchLongitude, userLatitude, userLongitude) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(branchLatitude);
  const lon1 = toRadians(branchLongitude);
  const lat2 = toRadians(userLatitude);
  const lon2 = toRadians(userLongitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function isInsideGeofence(branchLatitude, branchLongitude, radiusMeters, userLatitude, userLongitude) {
  const distance = calculateDistance(
    branchLatitude,
    branchLongitude,
    userLatitude,
    userLongitude
  );

  return {
    distance: Number(distance.toFixed(2)),
    inside: distance <= Number(radiusMeters)
  };
}

module.exports = {
  calculateDistance,
  isInsideGeofence
};
