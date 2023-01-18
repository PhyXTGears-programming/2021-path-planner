import Vector from './vector.js';

const PointPrototype = {
  addVec: function (vec) {
    return Point(this.x + vec.x, this.y + vec.y);
  },

  sub: function (other) {
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
