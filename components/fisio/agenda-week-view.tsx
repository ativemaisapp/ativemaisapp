"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  type AgendaAppointment,
  isDraggable,
  detectConflict,
  isValidTimeSlot,
  isNotPastDate,
  generateTimeSlots,
  getWeekStart,
  getWeekDays,
  formatDateISO,
} from "@/lib/agenda-rules";
import { Button } from "@/components/ui/button";
import { CascadeRescheduleModal } from "@/components/fisio/cascade-reschedule-modal";

type Props = {
  appointments: AgendaAppointment[];
  weekStart: Date;
  fisioId: string;
  userRole: "gestao" | "fisio";
  onWeekChange: (weekStart: Date) => void;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-laranja-ative text-white",
  in_progress: "bg-ambar-aviso text-white animate-pulse",
  completed: "bg-verde-sucesso text-white",
  missed: "bg-vermelho-alerta text-white",
  cancelled: "bg-cinza-texto/40 text-white line-through",
};

export function AgendaWeekView({
  appointments,
  weekStart,
  fisioId,
  userRole,
  onWeekChange,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Tutorial overlay
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    const key = "ative_week_tutorial_seen";
    if (!localStorage.getItem(key)) {
      setShowTutorial(true);
    }
  }, []);

  function dismissTutorial() {
    localStorage.setItem("ative_week_tutorial_seen", "1");
    setShowTutorial(false);
  }

  const days = getWeekDays(weekStart);

  return (
    <div className="relative">
      {/* Tutorial overlay */}
      {showTutorial && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="mx-4 max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <p className="text-sm text-tinta-texto">
              Segure e arraste para mover atendimentos. Se houver conflito, o
              app te ajuda a resolver.
            </p>
            <Button
              onClick={dismissTutorial}
              className="mt-4 bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
            >
              Entendi
            </Button>
          </div>
        </div>
      )}

      {isMobile ? (
        <MobileWeekView
          appointments={appointments}
          days={days}
          weekStart={weekStart}
          fisioId={fisioId}
          userRole={userRole}
          onWeekChange={onWeekChange}
        />
      ) : (
        <DesktopWeekView
          appointments={appointments}
          days={days}
          weekStart={weekStart}
          fisioId={fisioId}
          userRole={userRole}
          onWeekChange={onWeekChange}
        />
      )}
    </div>
  );
}

// ─── Week Navigation Header ────────────────────────────────────
function WeekHeader({
  weekStart,
  onWeekChange,
}: {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
}) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const label = `${format(weekStart, "dd MMM", { locale: ptBR })} - ${format(weekEnd, "dd MMM", { locale: ptBR })} · ${format(weekStart, "yyyy")}`;

  function prev() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    onWeekChange(d);
  }
  function next() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    onWeekChange(d);
  }
  function goToday() {
    onWeekChange(getWeekStart(new Date()));
  }

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-linha-suave hover:bg-creme-fundo cursor-pointer"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-tinta-texto capitalize">
          {label}
        </span>
        <button
          onClick={next}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-linha-suave hover:bg-creme-fundo cursor-pointer"
          aria-label="Proxima semana"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={goToday}
        className="cursor-pointer text-xs"
      >
        Hoje
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DESKTOP WEEK VIEW — 7-column grid
// ═══════════════════════════════════════════════════════════════
function DesktopWeekView({
  appointments,
  days,
  weekStart,
  fisioId,
  userRole,
  onWeekChange,
}: {
  appointments: AgendaAppointment[];
  days: Date[];
  weekStart: Date;
  fisioId: string;
  userRole: "gestao" | "fisio";
  onWeekChange: (d: Date) => void;
}) {
  const router = useRouter();
  const timeSlots = generateTimeSlots();
  const [cascadeModal, setCascadeModal] = useState<{
    dragged: AgendaAppointment;
    conflict: AgendaAppointment;
    targetDate: string;
    targetTime: string;
  } | null>(null);

  const todayStr = formatDateISO(new Date());

  // Build lookup: "date|time" -> appointment
  const apptMap = new Map<string, AgendaAppointment>();
  for (const a of appointments) {
    if (a.scheduledTime && a.status !== "cancelled") {
      apptMap.set(`${a.scheduledDate}|${a.scheduledTime.slice(0, 5)}`, a);
    }
  }

  // Check if sunday has appointments
  const sundayStr = formatDateISO(days[6]);
  const sundayHasAppts = appointments.some(
    (a) => a.scheduledDate === sundayStr && a.status !== "cancelled"
  );
  const [sundayExpanded, setSundayExpanded] = useState(false);

  async function handleCellClick(
    date: string,
    time: string,
    existingAppt?: AgendaAppointment
  ) {
    if (existingAppt) {
      router.push(`/atendimento/${existingAppt.id}`);
    }
  }

  return (
    <>
      <WeekHeader weekStart={weekStart} onWeekChange={onWeekChange} />

      <div className="overflow-x-auto rounded-lg border border-linha-suave bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-14 border-b border-r border-linha-suave bg-white p-2 text-left text-cinza-texto font-medium">
                Hora
              </th>
              {days.map((day, i) => {
                const dateStr = formatDateISO(day);
                const isToday = dateStr === todayStr;
                const isSunday = i === 6;

                if (
                  isSunday &&
                  !sundayHasAppts &&
                  !sundayExpanded
                ) {
                  return (
                    <th
                      key={dateStr}
                      className="border-b border-linha-suave p-2 text-center cursor-pointer hover:bg-creme-fundo w-10"
                      onClick={() => setSundayExpanded(true)}
                    >
                      <span className="block text-xs text-cinza-texto">
                        {format(day, "EEE", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-cinza-texto/60">
                        {format(day, "dd")}
                      </span>
                    </th>
                  );
                }

                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "border-b border-linha-suave p-2 text-center",
                      isToday && "bg-verde-ative/5"
                    )}
                  >
                    <span className="block capitalize text-xs text-cinza-texto">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                        isToday
                          ? "bg-verde-ative text-white"
                          : "text-tinta-texto"
                      )}
                    >
                      {format(day, "dd")}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot) => (
              <tr key={slot}>
                <td className="sticky left-0 z-10 border-r border-b border-linha-suave bg-white p-1 text-right text-cinza-texto/60 font-mono text-[11px]">
                  {slot}
                </td>
                {days.map((day, i) => {
                  const dateStr = formatDateISO(day);
                  const key = `${dateStr}|${slot}`;
                  const appt = apptMap.get(key);
                  const isToday = dateStr === todayStr;
                  const isSunday = i === 6;

                  if (
                    isSunday &&
                    !sundayHasAppts &&
                    !sundayExpanded
                  ) {
                    return (
                      <td
                        key={key}
                        className="border-b border-linha-suave w-10"
                      />
                    );
                  }

                  return (
                    <td
                      key={key}
                      className={cn(
                        "border-b border-linha-suave p-0.5 h-10",
                        isToday && "bg-verde-ative/5"
                      )}
                    >
                      {appt ? (
                        <button
                          onClick={() =>
                            handleCellClick(dateStr, slot, appt)
                          }
                          className={cn(
                            "w-full rounded px-1 py-0.5 text-left text-[11px] font-medium leading-tight truncate cursor-pointer shadow-sm",
                            STATUS_COLORS[appt.status] || "bg-cinza-texto/20"
                          )}
                          title={`${appt.patientName} - ${slot}`}
                        >
                          {appt.patientName.split(" ")[0]}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cascadeModal && (
        <CascadeRescheduleModal
          open={true}
          onClose={() => setCascadeModal(null)}
          draggedAppt={cascadeModal.dragged}
          conflictAppt={cascadeModal.conflict}
          targetDate={cascadeModal.targetDate}
          targetTime={cascadeModal.targetTime}
          allAppointments={appointments}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOBILE WEEK VIEW — one day at a time with swipe
// ═══════════════════════════════════════════════════════════════
function MobileWeekView({
  appointments,
  days,
  weekStart,
  fisioId,
  userRole,
  onWeekChange,
}: {
  appointments: AgendaAppointment[];
  days: Date[];
  weekStart: Date;
  fisioId: string;
  userRole: "gestao" | "fisio";
  onWeekChange: (d: Date) => void;
}) {
  const router = useRouter();
  const todayStr = formatDateISO(new Date());

  // Find today's index, default to 0 (Monday)
  const todayIndex = days.findIndex((d) => formatDateISO(d) === todayStr);
  const [currentDayIndex, setCurrentDayIndex] = useState(
    todayIndex >= 0 ? todayIndex : 0
  );

  const timeSlots = generateTimeSlots();
  const currentDay = days[currentDayIndex];
  const currentDateStr = formatDateISO(currentDay);

  const dayAppointments = appointments.filter(
    (a) => a.scheduledDate === currentDateStr && a.status !== "cancelled"
  );

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only swipe if horizontal movement > vertical and > 50px threshold
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && currentDayIndex < 6) {
        setCurrentDayIndex((i) => i + 1);
      } else if (dx > 0 && currentDayIndex > 0) {
        setCurrentDayIndex((i) => i - 1);
      }
    }
  }

  function prevDay() {
    if (currentDayIndex > 0) setCurrentDayIndex((i) => i - 1);
  }
  function nextDay() {
    if (currentDayIndex < 6) setCurrentDayIndex((i) => i + 1);
  }

  // Build appointment map for this day
  const apptByTime = new Map<string, AgendaAppointment>();
  for (const a of dayAppointments) {
    if (a.scheduledTime) {
      apptByTime.set(a.scheduledTime.slice(0, 5), a);
    }
  }

  const isToday = currentDateStr === todayStr;

  return (
    <div>
      <WeekHeader weekStart={weekStart} onWeekChange={onWeekChange} />

      {/* Day selector */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevDay}
          disabled={currentDayIndex === 0}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-linha-suave hover:bg-creme-fundo disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className={cn(
            "text-base font-semibold capitalize",
            isToday ? "text-verde-ative" : "text-tinta-texto"
          )}>
            {format(currentDay, "EEEE", { locale: ptBR })}
            {isToday && (
              <span className="ml-1.5 text-xs font-normal text-verde-sucesso">
                (hoje)
              </span>
            )}
          </p>
          <p className="text-sm text-cinza-texto">
            {format(currentDay, "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-cinza-texto/60">
            {currentDayIndex + 1} de 7
          </p>
        </div>

        <button
          onClick={nextDay}
          disabled={currentDayIndex === 6}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-linha-suave hover:bg-creme-fundo disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="mb-4 flex justify-center gap-1.5">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => setCurrentDayIndex(i)}
            className={cn(
              "h-2 w-2 rounded-full transition-colors cursor-pointer",
              i === currentDayIndex
                ? "bg-verde-ative"
                : "bg-cinza-texto/20"
            )}
            aria-label={format(day, "EEEE", { locale: ptBR })}
          />
        ))}
      </div>

      {/* Timeline */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="space-y-1"
      >
        {timeSlots.map((slot) => {
          const appt = apptByTime.get(slot);

          if (appt) {
            return (
              <button
                key={slot}
                onClick={() => router.push(`/atendimento/${appt.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left shadow-sm cursor-pointer",
                  STATUS_COLORS[appt.status] || "bg-cinza-texto/20"
                )}
              >
                <span className="text-sm font-semibold min-w-[40px]">
                  {slot}
                </span>
                <span className="text-sm font-medium truncate flex-1">
                  {appt.patientName}
                </span>
              </button>
            );
          }

          return (
            <div
              key={slot}
              className="flex items-center gap-3 rounded-lg border border-dashed border-linha-suave px-3 py-2 min-h-[40px]"
            >
              <span className="text-sm text-cinza-texto/40 min-w-[40px]">
                {slot}
              </span>
              <span className="text-xs text-cinza-texto/30">
                Disponivel
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
