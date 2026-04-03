export function vibrate(pattern: number | number[] = 15) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export function vibrateSuccess() {
  vibrate([30, 20, 30]);
}

export function vibrateError() {
  vibrate([100, 50, 100]);
}

export function vibrateTap() {
  vibrate(10);
}
