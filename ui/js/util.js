export function map(value, x1, w1, x2, w2) {
  return (value - x1) * w2 / w1 + x2;
}
