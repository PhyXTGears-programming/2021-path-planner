export const throttleLast = (delayMs, fn) => {
  let savedArgs = [];
  let isInactive = true;

  return (...args) => {
    savedArgs = args;

    if (isInactive) {
      isInactive = false;
      setTimeout(
        () => {
          fn(...savedArgs);
          isInactive = true;
        },
        delayMs
      );
    }
  };
};
