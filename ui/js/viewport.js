import Point from './geom/point.js';
import Vector from './geom/vector.js';

export default (zoomFactor) => ({
  offset: Vector(0, 0),
  scale: 1.0,

  panVec: Vector(0, 0),

  zoomIn(pt) {
    this.zoom(pt, this.scale * (1.0 / zoomFactor));
  },

  zoomOut(pt) {
    this.zoom(pt, this.scale * (zoomFactor / 1.0));
  },

  zoom(unitPt, scale) {
    const prevScale = this.scale;

    // ua :: Vector
    // let ua be vector to anchor pt from origin of unit coordinate system.
    const ua = unitPt.sub(Point(0, 0));

    // ub1 :: Vector
    // let ub1 be vector to corner of previous-scaled origin in unit coordinate system.
    const ub1 = this.offset;

    // uc :: Vector
    // let uc be vector to corner of previous-scaled origin from anchor in unit coordinate system.
    const uc = ub1.sub(ua);

    // ucc :: Vector
    // while uc is in unit coordinate system, it's length matches that of vector in previous-scale coordinate system.
    // let ucc be vector uc scaled from previous-scale to unit scale.
    const ucc = uc.scale(1.0 / prevScale);

    // ub2:: Vector
    // let ub2 be vector (in unit coordinate system) from origin to new-scale corner/origin.
    const ub2 = ua.add(ucc.scale(scale));

    this.offset = ub2;
    this.scale = scale;
  },

  startPan(offset) {
    this.panVec = offset;
  },

  pan(offset) {
    this.offset = this.offset.add(offset.sub(this.panVec));
    this.panVec = offset;
  },

  resetZoom() {
    this.zoom = 1.0;
  },

  resetPan() {
    this.offset = Vector(0.0, 0.0);
  },

  toViewCoord(vec) {
    return vec.sub(this.offset).scale(1.0 / this.scale);
  },

  toUnitCoord(vec) {
    return vec.scale(this.scale).add(this.offset);
  },
});
