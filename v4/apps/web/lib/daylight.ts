/**
 * Day or night in Istanbul, from the sunrise equation (within a few minutes
 * of published times all year). Picks the theme for visitors who have not
 * chosen one.
 *
 * Self-contained on purpose: the root layout inlines its source as a tiny
 * script that sets the theme before first paint.
 */
export function istanbulDaylight(now: number): { theme: 'light' | 'dark'; nextChange: number } {
  const LAT = 41.0082;
  const LON_EAST = 28.9784;
  const RAD = Math.PI / 180;
  const J2000 = 2451545;
  const toJulian = (ms: number) => ms / 86400000 + 2440587.5;
  const toMs = (julian: number) => (julian - 2440587.5) * 86400000;

  const riseAndSet = (julian: number) => {
    const westLon = -LON_EAST;
    const cycle = Math.round(julian - J2000 - 0.0009 - westLon / 360);
    const noon = J2000 + 0.0009 + westLon / 360 + cycle;
    const anomaly = (357.5291 + 0.98560028 * (noon - J2000)) % 360;
    const m = anomaly * RAD;
    const centre = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
    const longitude = ((anomaly + centre + 180 + 102.9372) % 360) * RAD;
    const transit = noon + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * longitude);
    const declination = Math.asin(Math.sin(longitude) * Math.sin(23.4397 * RAD));
    const cosHour =
      (Math.sin(-0.833 * RAD) - Math.sin(LAT * RAD) * Math.sin(declination)) /
      (Math.cos(LAT * RAD) * Math.cos(declination));
    const halfDay = Math.acos(cosHour) / RAD / 360;
    return { rise: transit - halfDay, set: transit + halfDay };
  };

  const julian = toJulian(now);
  const today = riseAndSet(julian);
  if (julian < today.rise) return { theme: 'dark', nextChange: toMs(today.rise) };
  if (julian < today.set) return { theme: 'light', nextChange: toMs(today.set) };
  return { theme: 'dark', nextChange: toMs(riseAndSet(julian + 1).rise) };
}
