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

RotationList.prototype.insertRotation = function (tval) {
    this.rotations.push( new Rotation(tval) );
};