/** @module vector */

/**
 * @typedef {object} Vector
 * @property {number} x
 * @property {number} y
 */

const VectorPrototype = {
  add: function (other) {
    return Vector(this.x + other.x, this.y + other.y);
  },

  sub: function (other) {
    return Vector(this.x - other.x, this.y - other.y);
  },

  scale: function (factor) {
    return Vector(this.x * factor, this.y * factor);
  },

  length: function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },

  lengthSq: function () {
    return this.x * this.x + this.y * this.y;
  },

  unit: function () {
    const length = this.length();

    // If near zero, return a zero vector.
    if (0.001 > length) {
      return Vector(0, 0);
    } else {
      return this.scale(1 / this.length());
    }
  },
};

/**
 * @constructor
 * @param {number} x
 * @param {number} y
 */
const Vector = (x, y) => {
  const self = Object.create(VectorPrototype);
  self.x = x;
  self.y = y;
  return self;
};

Vector.i = Vector(1, 0);
Vector.j = Vector(0, 1);

export default Vector;
