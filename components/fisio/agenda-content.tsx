"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type AgendaAppointment } from "@/lib/agenda-rules";
import { AgendaDayView } from "@/components/fisio/agenda-day-view";
import { AgendaWeekView } from "@/components/fisio/agenda-week-view";

type Props = {
  appointments: AgendaAppointment[];
  allWeekAppointments: AgendaAppointment[];
  selectedDate: string;
  isToday: boolean;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  missedCount?: number;
  cancelledCount?: number;
  fisioId?: string;
  userRole: "gestao" | "fisio";
  viewMode: "dia" | "semana";
  weekStartDate: string;
};

export function AgendaContent({
  appointments,
  allWeekAppointments,
  selectedDate,
  isToday,
  totalCount,
  completedCount,
  pendingCount,
  missedCount = 0,
  cancelledCount = 0,
  fisioId,
  userRole,
  viewMode,
  weekStartDate,
}: Props) {
  const router = useRouter();

  function handleDateChange(date: string) {
    router.push(`/agenda?data=${date}&view=${viewMode}`);
  }

  function handleWeekChange(newWeekStart: Date) {
    const dateStr = `${newWeekStart.getFullYear()}-${String(newWeekStart.getMonth() + 1).padStart(2, "0")}-${String(newWeekStart.getDate()).padStart(2, "0")}`;
    router.push(`/agenda?data=${dateStr}&view=semana`);
  }

  return (
    <>
      {/* Date picker + resumo (only in day view) */}
      {viewMode === "dia" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-tinta-texto/10 text-tinta-texto border-transparent text-xs">
              {totalCount} {totalCount === 1 ? "atendimento" : "atendimentos"}
            </Badge>
            <Badge className="bg-verde-sucesso/15 text-verde-sucesso border-transparent text-xs">
              {completedCount} {completedCount === 1 ? "concluido" : "concluidos"}
            </Badge>
            <Badge className="bg-laranja-ative/15 text-laranja-ative border-transparent text-xs">
              {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
            </Badge>
            {missedCount > 0 && (
              <Badge className="bg-ambar-aviso/15 text-ambar-aviso border-transparent text-xs">
                {missedCount} {missedCount === 1 ? "falta" : "faltas"}
              </Badge>
            )}
            {cancelledCount > 0 && (
              <Badge className="bg-cinza-texto/10 text-cinza-texto border-transparent text-xs">
                {cancelledCount} {cancelledCount === 1 ? "cancelado" : "cancelados"}
              </Badge>
            )}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-tinta-texto outline-none cursor-pointer"
          />
        </div>
      )}

      {/* View content */}
      {viewMode === "dia" ? (
        appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-cinza-texto">
            <Calendar className="h-12 w-12" />
            <p className="text-lg">Sem atendimentos nesta data.</p>
            {isToday && (
              <p className="text-sm">Aproveite para descansar.</p>
            )}
          </div>
        ) : (
          <AgendaDayView
            appointments={appointments}
            allWeekAppointments={allWeekAppointments}
            selectedDate={selectedDate}
            isToday={isToday}
            fisioId={fisioId || ""}
            userRole={userRole}
          />
        )
      ) : (
        <AgendaWeekView
          appointments={allWeekAppointments}
          weekStart={new Date(weekStartDate)}
          fisioId={fisioId || ""}
          userRole={userRole}
          onWeekChange={handleWeekChange}
        />
      )}
    </>
  );
}
