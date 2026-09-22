const STORAGE_KEY = "kamyas_dryer_run_duration_minutes";

/** Matches legacy Dashboard default (3600 s). */
export const DEFAULT_DRYER_RUN_MINUTES = 60;

/** Firmware `heat_secs` caps at 86400 s. */
export const MIN_DRYER_RUN_MINUTES = 1;
export const MAX_DRYER_RUN_MINUTES = 24 * 60;

export function getDryerRunMinutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      return DEFAULT_DRYER_RUN_MINUTES;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      return DEFAULT_DRYER_RUN_MINUTES;
    }
    return Math.min(
      MAX_DRYER_RUN_MINUTES,
      Math.max(MIN_DRYER_RUN_MINUTES, n)
    );
  } catch {
    return DEFAULT_DRYER_RUN_MINUTES;
  }
}

export function setDryerRunMinutes(minutes) {
  const n = Math.min(
    MAX_DRYER_RUN_MINUTES,
    Math.max(MIN_DRYER_RUN_MINUTES, Math.round(Number(minutes)))
  );
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore quota */
  }
  return n;
}

export function getDryerRunSeconds() {
  return getDryerRunMinutes() * 60;
}

const HEAT_LEVEL_KEY = "kamyas_dryer_heat_level";
export const DEFAULT_HEAT_LEVEL = 3;
export const MIN_HEAT_LEVEL = 1;
export const MAX_HEAT_LEVEL = 4;

export function getHeatLevel() {
  try {
    const raw = localStorage.getItem(HEAT_LEVEL_KEY);
    if (raw == null) return DEFAULT_HEAT_LEVEL;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_HEAT_LEVEL;
    return Math.min(MAX_HEAT_LEVEL, Math.max(MIN_HEAT_LEVEL, n));
  } catch {
    return DEFAULT_HEAT_LEVEL;
  }
}

export function setHeatLevel(level) {
  const n = Math.min(
    MAX_HEAT_LEVEL,
    Math.max(MIN_HEAT_LEVEL, Math.round(Number(level)))
  );
  try {
    localStorage.setItem(HEAT_LEVEL_KEY, String(n));
  } catch {
    /* ignore */
  }
  return n;
}
