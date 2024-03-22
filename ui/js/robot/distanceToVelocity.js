export function simple(parameters = {}) {
  return function (distance) {
    return parameters.maxVelocityMetersPerSecond;
  }
}
