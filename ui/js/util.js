export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function map(value, x1, w1, x2, w2) {
  return (value - x1) * w2 / w1 + x2;
}

export const IdGen = () => {
  let idCounter = 0;

  return () => {
    const ret = idCounter;
    idCounter += 1;
    return ret;
  };
};
