"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Check,
  Clock,
  GripHorizontal,
  MapPin,
  X,
} from "lucide-react";
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
  normalizeTime,
} from "@/lib/agenda-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppointmentActions } from "@/components/fisio/appointment-actions";
import { CascadeRescheduleModal } from "@/components/fisio/cascade-reschedule-modal";

type Props = {
  appointments: AgendaAppointment[];
  allWeekAppointments: AgendaAppointment[];
  selectedDate: string;
  isToday: boolean;
  fisioId: string;
  userRole: "gestao" | "fisio";
};

export function AgendaDayView({
  appointments,
  allWeekAppointments,
  selectedDate,
  isToday,
  fisioId,
  userRole,
}: Props) {
  const router = useRouter();
  const timeSlots = generateTimeSlots();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [cascadeModal, setCascadeModal] = useState<{
    dragged: AgendaAppointment;
    conflict: AgendaAppointment;
    targetDate: string;
    targetTime: string;
  } | null>(null);
  const [moveModal, setMoveModal] = useState<AgendaAppointment | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { delay: 300, tolerance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 300, tolerance: 8 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const activeAppt = activeId
    ? appointments.find((a) => a.id === activeId)
    : null;

  // Map time -> appointments for quick lookup (supports multiple per slot)
  const apptByTime = new Map<string, AgendaAppointment[]>();
  for (const a of appointments) {
    const t = normalizeTime(a.scheduledTime);
    if (t && a.status !== "cancelled") {
      const arr = apptByTime.get(t) || [];
      arr.push(a);
      apptByTime.set(t, arr);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;

    if (appt.fisioId !== fisioId && userRole !== "gestao") {
      toast.error("Voce nao pode mover atendimentos de outras profissionais.");
      return;
    }

    setActiveId(id);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const draggedId = activeId;
    setActiveId(null);
    const { over } = event;
    if (!over || !draggedId) return;

    const appt = appointments.find((a) => a.id === draggedId);
    if (!appt) return;

    const targetTime = String(over.id);
    if (targetTime === normalizeTime(appt.scheduledTime)) return;

    executeMoveLogic(appt, selectedDate, targetTime);
  }

  function executeMoveLogic(
    appt: AgendaAppointment,
    date: string,
    time: string
  ) {
    if (!isValidTimeSlot(time)) {
      toast.error("Horario fora da janela permitida (06:00-21:00).");
      return;
    }
    if (!isNotPastDate(date)) {
      toast.error("Nao e possivel mover para datas passadas.");
      return;
    }

    const conflict = detectConflict(allWeekAppointments, date, time, appt.id);
    if (conflict) {
      setCascadeModal({
        dragged: appt,
        conflict,
        targetDate: date,
        targetTime: time,
      });
      return;
    }

    moveAppointmentDirect(appt.id, date, time);
  }

  async function moveAppointmentDirect(
    id: string,
    date: string,
    time: string
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_date: date, scheduled_time: time })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao mover: " + error.message);
      return;
    }
    toast.success(`Atendimento movido para ${time}`);
    router.refresh();
  }

  function openMoveModal(appt: AgendaAppointment) {
    setMoveModal(appt);
    setMoveDate(appt.scheduledDate);
    setMoveTime(normalizeTime(appt.scheduledTime) || "08:00");
  }

  function handleMoveConfirm() {
    if (!moveModal || !moveDate || !moveTime) return;
    const appt = moveModal;
    setMoveModal(null);
    executeMoveLogic(appt, moveDate, moveTime);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-1.5">
          {timeSlots.map((slot) => {
            const slotAppts = apptByTime.get(slot) || [];
            return (
              <SlotDropZone
                key={slot}
                time={slot}
                isActive={activeId !== null}
              >
                {slotAppts.length > 0
                  ? slotAppts.map((appt) => (
                      <DraggableCard
                        key={appt.id}
                        appt={appt}
                        selectedDate={selectedDate}
                        fisioId={fisioId}
                        userRole={userRole}
                        onOpenMove={openMoveModal}
                      />
                    ))
                  : null}
              </SlotDropZone>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 300, easing: "ease-out" }}>
          {activeAppt && (
            <div className="w-full max-w-lg rounded-xl border border-verde-ative bg-white p-3 shadow-2xl">
              <p className="text-base font-semibold text-tinta-texto">
                {activeAppt.patientName}
              </p>
              <p className="text-sm text-cinza-texto">
                {normalizeTime(activeAppt.scheduledTime)}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {cascadeModal && (
        <CascadeRescheduleModal
          open={true}
          onClose={() => setCascadeModal(null)}
          draggedAppt={cascadeModal.dragged}
          conflictAppt={cascadeModal.conflict}
          targetDate={cascadeModal.targetDate}
          targetTime={cascadeModal.targetTime}
          allAppointments={allWeekAppointments}
        />
      )}

      <Dialog
        open={moveModal !== null}
        onOpenChange={(o) => !o && setMoveModal(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover atendimento</DialogTitle>
            <DialogDescription>
              {moveModal?.patientName} —{" "}
              {moveModal?.scheduledDate.split("-").reverse().join("/")}{" "}
              {normalizeTime(moveModal?.scheduledTime)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-tinta-texto">
                Nova data
              </label>
              <input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-tinta-texto">
                Novo horario
              </label>
              <input
                type="time"
                value={moveTime}
                onChange={(e) => setMoveTime(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveModal(null)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMoveConfirm}
              disabled={!moveDate || !moveTime}
              className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Drop Zone (wraps each time slot) ──────────────────────────
function SlotDropZone({
  time,
  isActive,
  children,
}: {
  time: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: time });

  if (children) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg transition-all",
          isOver && "ring-2 ring-dashed ring-vermelho-alerta animate-pulse"
        )}
      >
        {children}
      </div>
    );
  }

  // Empty slot
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
        isOver
          ? "border-verde-ative bg-verde-ative/5 border-2 animate-pulse"
          : "border-linha-suave",
        isActive ? "min-h-[64px]" : "min-h-[48px]"
      )}
    >
      <span className="text-sm font-medium text-cinza-texto/60 w-12">
        {time}
      </span>
      <span className="text-sm text-cinza-texto/40">Disponivel</span>
    </div>
  );
}

// ─── Draggable Card ────────────────────────────────────────────
function DraggableCard({
  appt,
  selectedDate,
  fisioId,
  userRole,
  onOpenMove,
}: {
  appt: AgendaAppointment;
  selectedDate: string;
  fisioId: string;
  userRole: "gestao" | "fisio";
  onOpenMove: (a: AgendaAppointment) => void;
}) {
  const canDrag = isDraggable(appt.status);
  const canControl = appt.fisioId === fisioId || userRole === "gestao";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: appt.id,
    disabled: !canDrag || !canControl,
  });

  const time = normalizeTime(appt.scheduledTime) || "—";

  // ── Completed ──
  if (appt.status === "completed") {
    return (
      <Card className="border-l-[3px] border-l-verde-sucesso/40 opacity-70">
        <CardContent className="flex items-center gap-3 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verde-sucesso/10">
            <Check className="h-5 w-5 text-verde-sucesso" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tinta-texto">{appt.patientName}</p>
            <p className="text-xs text-cinza-texto">
              Concluido as{" "}
              {appt.checkOutAt
                ? format(new Date(appt.checkOutAt), "HH:mm")
                : "—"}
            </p>
          </div>
          <span className="text-sm text-cinza-texto">{time}</span>
        </CardContent>
      </Card>
    );
  }

  // ── Missed / Cancelled ──
  if (appt.status === "missed" || appt.status === "cancelled") {
    return (
      <Card className="opacity-60">
        <CardContent className="flex items-center gap-3 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cinza-texto/10">
            <X className="h-5 w-5 text-cinza-texto" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tinta-texto">{appt.patientName}</p>
            <p className="text-xs text-cinza-texto">
              {appt.status === "missed" ? "Faltou" : "Cancelado"}
            </p>
          </div>
          <span className="text-sm text-cinza-texto">{time}</span>
        </CardContent>
      </Card>
    );
  }

  // ── In Progress ──
  if (appt.status === "in_progress") {
    const checkinTime = appt.checkInAt
      ? format(new Date(appt.checkInAt), "HH:mm")
      : "—";
    return (
      <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
        <Card className="border-l-[3px] border-l-verde-sucesso">
          <CardContent className="space-y-3 pt-1">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                {canDrag && canControl && (
                  <button
                    {...attributes}
                    {...listeners}
                    className="mt-1 cursor-grab touch-none text-cinza-texto/60 hover:text-cinza-texto active:cursor-grabbing"
                    aria-label="Arrastar para mover"
                  >
                    <GripHorizontal className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <p className="text-lg font-semibold text-tinta-texto">
                    {appt.patientName}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-verde-sucesso">
                    <Clock className="h-3 w-3" />
                    Em andamento desde {checkinTime}
                  </p>
                </div>
              </div>
              <span className="text-lg font-semibold text-tinta-texto">
                {time}
              </span>
            </div>
            <div className="flex gap-2">
              <Link href={`/atendimento/${appt.id}`} className="flex-1">
                <Button className="h-12 w-full bg-verde-sucesso hover:bg-verde-sucesso/90 text-white text-base cursor-pointer">
                  Continuar atendimento
                </Button>
              </Link>
              {canControl && (
                <AppointmentActions
                  appointment={appt}
                  fisioId={fisioId}
                  selectedDate={selectedDate}
                  onMove={() => onOpenMove(appt)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Scheduled ──
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <Card className="border-l-[3px] border-l-laranja-ative">
        <CardContent className="space-y-3 pt-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {canDrag && canControl && (
                <button
                  {...attributes}
                  {...listeners}
                  className="mt-1 cursor-grab touch-none text-cinza-texto/60 hover:text-cinza-texto active:cursor-grabbing"
                  aria-label="Arrastar para mover"
                >
                  <GripHorizontal className="h-5 w-5" />
                </button>
              )}
              <div>
                <p className="text-lg font-semibold text-tinta-texto">
                  {appt.patientName}
                </p>
                {appt.address && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-cinza-texto">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{appt.address}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-tinta-texto">
                {time}
              </span>
              <Badge className="mt-1 block bg-laranja-ative/15 text-laranja-ative border-transparent text-xs">
                {appt.weeklyFrequency}x/sem
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/atendimento/${appt.id}`} className="flex-1">
              <Button className="h-12 w-full bg-verde-ative hover:bg-verde-ative/90 text-white text-base cursor-pointer">
                Iniciar atendimento
              </Button>
            </Link>
            {fisioId && (
              <AppointmentActions
                appointment={appt}
                fisioId={fisioId}
                selectedDate={selectedDate}
                onMove={canControl ? () => onOpenMove(appt) : undefined}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
