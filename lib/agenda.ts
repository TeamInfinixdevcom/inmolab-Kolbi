export type EventSchedule = {
  date: string;
  time: string;
};

export type TaskSchedule = {
  dueDate?: string | null;
  status: string;
};

export function isValidDateTime(date: string, time: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
}

export function getCostaRicaDateTime(now = new Date()): EventSchedule {
  const values = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );

  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    time: `${values.get("hour")}:${values.get("minute")}`,
  };
}

export function isTaskOverdue(task: TaskSchedule, today: string): boolean {
  return task.status !== "Completada" && Boolean(task.dueDate) && task.dueDate! < today;
}

export function isEventInPast(event: EventSchedule, now: EventSchedule): boolean {
  if (!isValidDateTime(event.date, event.time)) return false;
  return `${event.date}T${event.time}` < `${now.date}T${now.time}`;
}

export function formatEventDateTime(date: string, time: string): string {
  if (!isValidDateTime(date, time)) return "Fecha y hora no disponibles";

  const instant = new Date(`${date}T${time}:00-06:00`);
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Costa_Rica",
  }).format(instant);
}

export function formatActivityDate(value: unknown): string {
  const date = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
        ? value.toDate()
        : null;

  if (!date || Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Costa_Rica",
  }).format(date);
}
