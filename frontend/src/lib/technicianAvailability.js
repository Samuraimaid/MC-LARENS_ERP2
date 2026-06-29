const SEMAPHORE_STYLES = {
  green: {
    label: "Libre",
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  yellow: {
    label: "Trabajando",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]",
    badge: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  },
  red: {
    label: "No disponible",
    dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.55)]",
    badge: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
  },
};

const ATTENDANCE_HINTS = {
  absent: "Sin marcación de entrada",
  lunch: "En almuerzo (reloj marcador)",
  clocked_out: "Ya marcó salida",
  present: "Presente en jornada",
};

export function getTechnicianAvailability(member) {
  const level = member?.availability_level || "red";
  const jobs = Math.max(0, Number(member?.active_jobs) || 0);
  const attendance = member?.attendance_state || "absent";
  const assignable = member?.availability_assignable !== false && level !== "red"
    ? member?.availability_assignable !== false
    : Boolean(member?.availability_assignable);

  let label = SEMAPHORE_STYLES[level]?.label || "No disponible";
  if (attendance === "lunch") label = "En almuerzo";
  else if (attendance === "absent") label = "Ausente";
  else if (attendance === "clocked_out") label = "Salió";
  else if (level === "yellow") label = "Trabajando (1)";
  else if (level === "red" && jobs >= 2) label = "2+ trabajos";

  return {
    level,
    jobs,
    attendance,
    assignable: assignable && attendance === "present" && jobs < 2,
    label,
    attendanceLabel: member?.attendance_label || ATTENDANCE_HINTS[attendance] || attendance,
    hint: ATTENDANCE_HINTS[attendance] || "",
    ...SEMAPHORE_STYLES[level],
  };
}

export function getAttendanceSummary(team = []) {
  const summary = { present: 0, lunch: 0, absent: 0, clocked_out: 0, available: 0 };
  for (const member of team) {
    const state = member?.attendance_state || "absent";
    if (summary[state] != null) summary[state] += 1;
    if (member?.availability_level === "green" && state === "present") {
      summary.available += 1;
    }
  }
  return summary;
}

export { SEMAPHORE_STYLES };