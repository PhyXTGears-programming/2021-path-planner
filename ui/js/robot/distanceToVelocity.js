export function simple(parameters = {}) {
  return function (distance) {
    return parameters.maxVelocityMetersPerSecond;
  }
}

export function accelerate(parameters = {}) {
  // let d be distance in meters
  // let t be time in seconds
  // let v0 be initial velocity
  // let a0 be initial acceleration
  // let v(t) be velocity at time, t
  // let x(t) be position at time, t
  // let v'(d) be velocity at distance, d
  //
  // v(t) = v0 + a0 * t                               (1)
  // x(t) = x0 + v0 * t + 0.5 * a0 * t^2              (2)
  // x(t) - x0 = d = v0 * t + 0.5 * a0 * t^2
  // d = 0.5 * a0 * t^2 + v0 * t
  // 0 = 0.5 * a0 * t^2 + v0 * t - d
  // t = \frac{-v0 +/- \sqrt{v0^2 - 4 * 0.5 * a0 * -d}}{2 * 0.5 * a0}
  // t = \frac{-v0 +/- \sqrt{v0^2 + 2d * a0}}{a0}
  // t = \frac{-v0 +/- \sqrt{v0^2 + 2d * a0}}{a0}     (2.1)
  //
  // // t must be positive
  // t(d) = \frac{-v0 + \sqrt{v0^2 + 2d * a0}}{a0}    (2.2)
  //
  // subst (2.2) for t of (1)
  // v'(d) = v(t(d)) = v0 + a0 * \frac{-v0 + \sqrt{v0^2 + 2d * a0}}{a0}
  // v'(d) = v0 + -v0 + \sqrt(v0^2 + 2d * a0}
  // v1(d) = \sqrt{v0^2 + 2d * a0}

  return function(distance, current_velocity) {
    return Math.min(
      parameters.maxVelocityMetersPerSecond,
      Math.sqrt(
        Math.pow(current_velocity, 2)
        + parameters.maxAccelerationMetersPerSecondSecond
        * 2
        * distance
      )
    );
  }
}
