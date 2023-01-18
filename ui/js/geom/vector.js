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

const Vector = (x, y) => {
  const self = Object.create(VectorPrototype);
  self.x = x;
  self.y = y;
  return self;
};

export default Vector;
