import Point from './geom/point.js';
import { map } from './util.js';

export const mouseEventToCanvasPoint = (ev, canvas) => {
  // Compute the screen position of the cursor relative to the canvas.
  const x = ev.clientX - canvas.offsetLeft;
  const y = ev.clientY - canvas.clientTop;

  // Compute the canvas position of the cursor relative to the canvas.
  const x2 = map(x, 0, canvas.offsetWidth, 0, canvas.width);
  const y2 = map(y, 0, canvas.offsetHeight, 0, canvas.height);

  return Point(x2, y2);
};
