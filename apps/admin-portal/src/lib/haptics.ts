// Progressive enhancement — navigator.vibrate doesn't exist on iOS Safari
// or desktop browsers, so this silently no-ops there.
export function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
