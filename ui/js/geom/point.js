import Vector from './vector.js';

const PointPrototype = {
  addVec (vec) {
    return Point(this.x + vec.x, this.y + vec.y);
  },

  vecFromOrigin () {
    return Vector(this.x, this.y);
  },

  sub (other) {
    return Vector(this.x - other.x, this.y - other.y);
  },
};

const Point = (x, y) => {
  const self = Object.create(PointPrototype);
  self.x = x;
  self.y = y;
  return self;
};

export default Point;
