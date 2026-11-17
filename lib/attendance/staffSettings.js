// The attendance rules a person needs to read their own hours (17 Nov 2026).
//
// Staff can't read the branch's settings document: it also holds the cash
// and sales settings. Without its day cut-off and shifts, the staff app put a
// 01:50 clock-out on the next day, so every overnight shift showed "a clock-in
// or clock-out is missing". The server hands out just this part
// (app/api/attendance/settings).
//
// Pure — no React, no Firebase.
import { isValidTimeZone } from "../region/businessDay";

/**
 * The attendance part of a branch's settings document, plus the branch's time
 * zone (null when none is set — the phone then uses its own clock, as before).
 */
export function attendanceSettingsOf(settings) {
  const attendance = settings?.attendance && typeof settings.attendance === "object" ? settings.attendance : {};
  const tz = settings?.basic?.timeZone;
  return { ...attendance, timeZone: isValidTimeZone(tz) ? tz : null };
}

/** May this signed-in user (their users/{uid} doc) read this branch's attendance rules? */
export function mayReadAttendanceRules(me, companyId, branchId, isCompanyRole) {
  if (!me || !companyId || !branchId || me.companyId !== companyId) return false;
  if (me.disabled === true || me.active === false) return false;
  return isCompanyRole(me.role) || me.branchId === branchId;
}
