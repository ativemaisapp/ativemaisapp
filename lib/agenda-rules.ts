export type AgendaAppointment = {
  id: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  patientName: string;
  patientId: string;
  fisioId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  rescheduleReason: string | null;
  rescheduleNotes: string | null;
  rescheduledTo: string | null;
  address: string;
  weeklyFrequency: number;
};

/** Status que permitem arrastar */
export function isDraggable(status: string): boolean {
  return status === "scheduled" || status === "in_progress";
}

/** Detecta conflito: retorna appointment no slot alvo ou null */
export function detectConflict(
  appointments: AgendaAppointment[],
  targetDate: string,
  targetTime: string,
  excludeId: string
): AgendaAppointment | null {
  return (
    appointments.find(
      (a) =>
        a.id !== excludeId &&
        a.scheduledDate === targetDate &&
        a.scheduledTime?.slice(0, 5) === targetTime.slice(0, 5) &&
        (a.status === "scheduled" || a.status === "in_progress")
    ) ?? null
  );
}

/** Valida se horário está dentro da janela 06:00-21:00 */
export function isValidTimeSlot(time: string): boolean {
  const hour = parseInt(time.slice(0, 2), 10);
  return hour >= 6 && hour <= 20;
}

/** Valida se data não é passada */
export function isNotPastDate(dateStr: string): boolean {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateStr >= today;
}

/** Gera slots de horário das 06:00 às 20:00 (última sessão começa 20:00, termina 21:00) */
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 20; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

/** Retorna segunda-feira da semana para uma data */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Retorna array de 7 datas (seg-dom) a partir de uma segunda-feira */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Formata data para yyyy-MM-dd */
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Slots livres de um dia */
export function getFreeSlots(
  appointments: AgendaAppointment[],
  date: string
): string[] {
  const allSlots = generateTimeSlots();
  const occupied = new Set(
    appointments
      .filter(
        (a) =>
          a.scheduledDate === date &&
          (a.status === "scheduled" || a.status === "in_progress")
      )
      .map((a) => a.scheduledTime?.slice(0, 5))
  );
  return allSlots.filter((s) => !occupied.has(s));
}
