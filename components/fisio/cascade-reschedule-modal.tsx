"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/client";
import {
  type AgendaAppointment,
  getFreeSlots,
  getWeekStart,
  getWeekDays,
  formatDateISO,
} from "@/lib/agenda-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  /** O appointment que foi arrastado */
  draggedAppt: AgendaAppointment;
  /** O appointment que já ocupa o slot de destino */
  conflictAppt: AgendaAppointment;
  /** Novo dia/hora para onde o arrastado vai */
  targetDate: string;
  targetTime: string;
  /** Todos os appointments da semana para calcular slots livres */
  allAppointments: AgendaAppointment[];
};

type Step = 1 | 2 | 3;

export function CascadeRescheduleModal({
  open,
  onClose,
  draggedAppt,
  conflictAppt,
  targetDate,
  targetTime,
  allAppointments,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setStep(1);
    setSelectedDate("");
    setSelectedTime("");
    setExpandedDay(null);
    onClose();
  }

  // Slot que acabou de ser liberado pelo arrastado
  const freedSlot = draggedAppt.scheduledTime?.slice(0, 5) || "";
  const freedDate = draggedAppt.scheduledDate;

  // Slots livres do dia do conflito (incluindo o que vai ser liberado pelo arrastado)
  const todayFreeSlots = useMemo(() => {
    // Simula: o arrastado já saiu do dia original e foi para targetDate/targetTime
    // O conflito vai sair do targetDate/targetTime
    const simulated = allAppointments.filter(
      (a) => a.id !== draggedAppt.id && a.id !== conflictAppt.id
    );
    return getFreeSlots(simulated, targetDate);
  }, [allAppointments, draggedAppt.id, conflictAppt.id, targetDate]);

  // Próximos 6 dias úteis (excluindo o dia do conflito)
  const weekStart = getWeekStart(new Date(targetDate + "T12:00:00"));
  const otherDays = useMemo(() => {
    const days = getWeekDays(weekStart);
    // Adicionar próxima semana também
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextDays = getWeekDays(nextWeekStart);
    return [...days, ...nextDays]
      .filter((d) => formatDateISO(d) !== targetDate)
      .filter((d) => formatDateISO(d) >= formatDateISO(new Date()))
      .slice(0, 6);
  }, [weekStart, targetDate]);

  function getFreeSlotsForDay(date: string) {
    const simulated = allAppointments.filter(
      (a) => a.id !== draggedAppt.id && a.id !== conflictAppt.id
    );
    return getFreeSlots(simulated, date);
  }

  function selectSlot(date: string, time: string) {
    setSelectedDate(date);
    setSelectedTime(time);
  }

  async function handleConfirm() {
    setSaving(true);
    const supabase = createClient();
    const cascadeId = crypto.randomUUID();

    // Transação atômica: ambas atualizações ou nenhuma
    const { error: err1 } = await supabase
      .from("appointments")
      .update({
        scheduled_date: targetDate,
        scheduled_time: targetTime,
        reschedule_reason: "Movimentacao em cascata",
        reschedule_notes: `Movido junto com ${conflictAppt.patientName}`,
        cascade_pair_id: cascadeId,
      })
      .eq("id", draggedAppt.id);

    if (err1) {
      setSaving(false);
      toast.error("Erro ao mover primeiro atendimento: " + err1.message);
      return;
    }

    const { error: err2 } = await supabase
      .from("appointments")
      .update({
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        reschedule_reason: "Movimentacao em cascata",
        reschedule_notes: `Movido junto com ${draggedAppt.patientName}`,
        cascade_pair_id: cascadeId,
      })
      .eq("id", conflictAppt.id);

    if (err2) {
      // Rollback: reverter o primeiro
      await supabase
        .from("appointments")
        .update({
          scheduled_date: draggedAppt.scheduledDate,
          scheduled_time: draggedAppt.scheduledTime,
          reschedule_reason: null,
          reschedule_notes: null,
          cascade_pair_id: null,
        })
        .eq("id", draggedAppt.id);

      setSaving(false);
      toast.error("Erro ao mover segundo atendimento. Operacao revertida.");
      return;
    }

    setSaving(false);
    toast.success("Atendimentos movidos com sucesso");
    handleClose();
    router.refresh();
  }

  const conflictDateFormatted = format(
    new Date(targetDate + "T12:00:00"),
    "dd/MM",
    { locale: ptBR }
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {/* TELA 1 */}
        {step === 1 && (
          <div className="animate-in fade-in duration-200">
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ambar-aviso/15">
                <AlertTriangle className="h-7 w-7 text-ambar-aviso" />
              </div>
              <DialogTitle className="text-center">
                Conflito de horario
              </DialogTitle>
              <DialogDescription className="text-center">
                Voce ja tem{" "}
                <strong className="text-tinta-texto">
                  {conflictAppt.patientName}
                </strong>{" "}
                agendada para {conflictDateFormatted} as {targetTime}.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-4 text-center text-sm text-cinza-texto">
              O que deseja fazer com {conflictAppt.patientName.split(" ")[0]}?
            </p>
            <DialogFooter className="mt-4 sm:flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full cursor-pointer"
              >
                Cancelar movimentacao
              </Button>
              <Button
                onClick={() => setStep(2)}
                className="w-full bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer"
              >
                Mover {conflictAppt.patientName.split(" ")[0]} tambem
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* TELA 2 */}
        {step === 2 && (
          <div className="animate-in fade-in duration-200">
            <DialogHeader>
              <DialogTitle>
                Mover {conflictAppt.patientName.split(" ")[0]} para qual
                horario?
              </DialogTitle>
              <DialogDescription>
                {draggedAppt.patientName.split(" ")[0]} vai para{" "}
                {conflictDateFormatted} as {targetTime}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto">
              {/* Horários disponíveis hoje */}
              {todayFreeSlots.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-cinza-texto">
                    Horarios disponiveis em {conflictDateFormatted}
                  </p>
                  <div className="space-y-1.5">
                    {todayFreeSlots.map((slot) => {
                      const isFreed =
                        targetDate === freedDate && slot === freedSlot;
                      const isSelected =
                        selectedDate === targetDate && selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => selectSlot(targetDate, slot)}
                          className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "border-2 border-verde-ative bg-verde-ative/5"
                              : "border-linha-suave hover:bg-creme-fundo"
                          }`}
                        >
                          <div>
                            <span className="text-base font-semibold text-tinta-texto">
                              {slot}
                            </span>
                            {isFreed && (
                              <span className="ml-2 text-xs text-verde-sucesso">
                                horario liberado
                              </span>
                            )}
                            {!isFreed && (
                              <span className="ml-2 text-xs text-cinza-texto">
                                disponivel
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="h-5 w-5 text-verde-ative" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outros dias */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-cinza-texto">
                  Outros dias da semana
                </p>
                <div className="space-y-1.5">
                  {otherDays.map((day) => {
                    const dateStr = formatDateISO(day);
                    const dayLabel = format(day, "EEEE, dd/MM", {
                      locale: ptBR,
                    });
                    const isExpanded = expandedDay === dateStr;
                    const slots = getFreeSlotsForDay(dateStr);

                    return (
                      <div key={dateStr}>
                        <button
                          onClick={() =>
                            setExpandedDay(isExpanded ? null : dateStr)
                          }
                          className="flex w-full items-center justify-between rounded-lg border border-linha-suave p-3 text-left hover:bg-creme-fundo capitalize cursor-pointer"
                        >
                          <span className="text-sm font-medium text-tinta-texto">
                            {dayLabel}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-cinza-texto transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isExpanded && (
                          <div className="mt-1 ml-2 space-y-1 animate-in slide-in-from-top-2 duration-150">
                            {slots.length === 0 ? (
                              <p className="p-2 text-xs text-cinza-texto">
                                Sem horarios disponiveis
                              </p>
                            ) : (
                              slots.map((slot) => {
                                const isSelected =
                                  selectedDate === dateStr &&
                                  selectedTime === slot;
                                return (
                                  <button
                                    key={slot}
                                    onClick={() => selectSlot(dateStr, slot)}
                                    className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                                      isSelected
                                        ? "border-2 border-verde-ative bg-verde-ative/5"
                                        : "border-linha-suave hover:bg-creme-fundo"
                                    }`}
                                  >
                                    <span className="text-sm font-semibold text-tinta-texto">
                                      {slot}
                                    </span>
                                    {isSelected && (
                                      <Check className="h-4 w-4 text-verde-ative" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="cursor-pointer"
              >
                Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!selectedDate || !selectedTime}
                className="bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer"
              >
                Continuar
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* TELA 3 */}
        {step === 3 && (
          <div className="animate-in fade-in duration-200">
            <DialogHeader>
              <DialogTitle>Confirme as alteracoes</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-verde-sucesso/10 p-3">
                <Check className="mt-0.5 h-5 w-5 text-verde-sucesso shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-tinta-texto">
                    {draggedAppt.patientName}
                  </p>
                  <p className="text-cinza-texto">
                    {draggedAppt.scheduledDate.split("-").reverse().join("/")}{" "}
                    {draggedAppt.scheduledTime?.slice(0, 5)} →{" "}
                    {targetDate.split("-").reverse().join("/")}{" "}
                    {targetTime}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-verde-sucesso/10 p-3">
                <Check className="mt-0.5 h-5 w-5 text-verde-sucesso shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-tinta-texto">
                    {conflictAppt.patientName}
                  </p>
                  <p className="text-cinza-texto">
                    {conflictAppt.scheduledDate.split("-").reverse().join("/")}{" "}
                    {conflictAppt.scheduledTime?.slice(0, 5)} →{" "}
                    {selectedDate.split("-").reverse().join("/")}{" "}
                    {selectedTime}
                  </p>
                </div>
              </div>

              <p className="text-xs text-cinza-texto">
                Esta operacao sera registrada no historico de cada paciente.
              </p>
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="cursor-pointer"
              >
                Cancelar tudo
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="bg-verde-sucesso hover:bg-verde-sucesso/90 text-white cursor-pointer"
              >
                {saving ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
