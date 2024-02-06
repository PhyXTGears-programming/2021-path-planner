// export function rotationList() {
    
//     insertRotations() {
//         this.rotations.push({
//             t: tval, // Index of location along the path
//             rot: 0 // Rotation (Degrees?)
//         });
//     }

//     return {};
// }

export function RotationList() {
    this.rotations = [];
}

export function Rotation(tval) {
    this.t = tval;
    this.rot = 0;
}

export function toDegrees(rad) {
  return rad * (180/Math.PI);
}

export function toRadians(deg) {
  return deg * (Math.PI/180);
}

RotationList.prototype.insertRotation = function (tval) {
    this.rotations.push( new Rotation(tval) );
};

Rotation.prototype.setRotVal = function (rotval) {
    this.rot = rotval;
};