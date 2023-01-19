import Point from './point.js';

const BezierPrototype = {
  findTNearPoint (pt, maxDist, numSamples = 128) {
    const startTime = performance.now();

    const bez = this.withVec();

    let minD2 = Number.POSITIVE_INFINITY;
    let minT = 0;
    let minPt = null;

    const step = 1.0 / (numSamples - 1);

    for (let t = 0; t <= 1.0; t += step) {
      const bezPt = this.pointAt(t);

      if (null == bezPt) {
        continue;
      }

      const dist2 = pt.sub(bezPt).lengthSq();

      if (dist2 < minD2) {
        minD2 = dist2;
        minT = t;
        minPt = bezPt;
      }
    }

    // console.log('find t nearest point', 'duration', (performance.now() - startTime) / 1000, 'sec', 't', minT);

    if (minD2 >= maxDist * maxDist) {
      return { t: -1, pt: null, dist2: -1 };
    } {
      return { t: minT, pt: minPt, dist2: minD2 };
    }
  },

  pointAt (t) {
    if (t < 0.0 || 1.0 < t) {
      return null;
    }

    const bez = this.withVec();

    // Solve using polynomial coefficients to reduce math operations.
    // http://stackoverflow.com/questions/27001368/ddg#27003240
    // https://www.moshplant.com/direct-or/bezier/math.html

    const t2 = t * t;
    const t3 = t * t2;

    const D = bez.a;
    const C = bez.b.sub(bez.a).scale(3.0);
    const B = bez.c.sub(bez.b).scale(3.0).sub(C);
    const A = bez.d.sub(bez.a).sub(C).sub(B);

    return Point(
      A.x * t3 + B.x * t2 + C.x * t + D.x,
      A.y * t3 + B.y * t2 + C.y * t + D.y,
    );
  },

  withVec () {
    return {
      a: this.a.vecFromOrigin(),
      b: this.b.vecFromOrigin(),
      c: this.c.vecFromOrigin(),
      d: this.d.vecFromOrigin(),
    };
  },
};

const Bezier = (a, b, c, d) => {
  const self = Object.create(BezierPrototype);
  Object.assign(self, { a, b, c, d });
  return self;
};

export default Bezier;
