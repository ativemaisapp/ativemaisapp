"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX, XCircle, CalendarClock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  MISSED_REASONS,
  CANCELLED_REASONS,
  RESCHEDULE_REASONS,
} from "@/lib/evolution-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  scheduledTime: string | null;
  status: string;
};

type ActionType = "missed" | "cancelled" | "reschedule" | null;

export function AppointmentActions({
  appointment,
  fisioId,
  selectedDate,
}: {
  appointment: Appointment;
  fisioId: string;
  selectedDate: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<ActionType>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState("");

  function openAction(type: ActionType) {
    setAction(type);
    setReason("");
    setNotes("");
    setConflictWarning("");
    if (type === "reschedule") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNewDate(tomorrow.toISOString().split("T")[0]);
      setNewTime(appointment.scheduledTime?.slice(0, 5) || "08:00");
    }
  }

  function close() {
    setAction(null);
  }

  async function checkConflict() {
    if (!newDate || !newTime) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("appointments")
      .select("id, patients!inner(full_name)")
      .eq("fisio_id", fisioId)
      .eq("scheduled_date", newDate)
      .eq("scheduled_time", newTime)
      .eq("status", "scheduled")
      .limit(1);
    if (data && data.length > 0) {
      const name = (data[0].patients as unknown as { full_name: string })
        ?.full_name;
      setConflictWarning(
        `Você já tem ${name || "outro paciente"} agendado nesse horário.`
      );
    } else {
      setConflictWarning("");
    }
  }

  async function handleMissed() {
    if (!reason) {
      toast.error("Selecione o motivo da falta");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "missed" as const,
        reschedule_reason: reason,
        reschedule_notes: notes || null,
        check_in_at: null,
        check_out_at: null,
      })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Falta registrada");
    close();
    router.refresh();
  }

  async function handleCancelled() {
    if (!reason) {
      toast.error("Selecione o motivo do cancelamento");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled" as const,
        reschedule_reason: reason,
        reschedule_notes: notes || null,
      })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Cancelamento registrado");
    close();
    router.refresh();
  }

  async function handleReschedule() {
    if (!reason) {
      toast.error("Selecione o motivo da remarcação");
      return;
    }
    if (!newDate || !newTime) {
      toast.error("Informe a nova data e horário");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    // Criar novo appointment
    const { data: newAppt, error: insertError } = await supabase
      .from("appointments")
      .insert({
        patient_id: appointment.patientId,
        fisio_id: fisioId,
        scheduled_date: newDate,
        scheduled_time: newTime,
        status: "scheduled" as const,
      })
      .select("id")
      .single();

    if (insertError || !newAppt) {
      setSaving(false);
      toast.error("Erro ao criar novo agendamento: " + insertError?.message);
      return;
    }

    // Marcar original como cancelled com link para o novo
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "cancelled" as const,
        reschedule_reason: reason,
        reschedule_notes: notes || null,
        rescheduled_to: newAppt.id,
      })
      .eq("id", appointment.id);

    setSaving(false);
    if (updateError) {
      toast.error("Erro ao atualizar original: " + updateError.message);
      return;
    }

    const dateFormatted = newDate.split("-").reverse().join("/");
    toast.success(`Remarcado para ${dateFormatted} às ${newTime}`);
    close();
    router.refresh();
  }

  const time = appointment.scheduledTime?.slice(0, 5) || "—";
  const dateFormatted = selectedDate.split("-").reverse().join("/");

  return (
    <>
      {/* Dropdown trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-12 items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm hover:bg-creme-fundo cursor-pointer">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="19" r="1.5" fill="currentColor" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => openAction("missed")}
            className="cursor-pointer"
          >
            <UserX className="mr-2 h-4 w-4 text-ambar-aviso" />
            Registrar falta
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openAction("cancelled")}
            className="cursor-pointer"
          >
            <XCircle className="mr-2 h-4 w-4 text-cinza-texto" />
            Registrar cancelamento
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openAction("reschedule")}
            className="cursor-pointer"
          >
            <CalendarClock className="mr-2 h-4 w-4 text-verde-sucesso" />
            Remarcar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog Falta */}
      <Dialog open={action === "missed"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar falta</DialogTitle>
            <DialogDescription>
              {appointment.patientName} — {dateFormatted} às {time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo *</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Selecione...</option>
                {MISSED_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Detalhes adicionais..."
              />
            </div>
            <div className="flex items-start gap-2 rounded-md bg-ambar-aviso/10 p-3 text-sm text-ambar-aviso">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Faltas sem aviso prévio são cobráveis da família conforme
                contrato.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleMissed}
              disabled={saving}
              className="bg-ambar-aviso hover:bg-ambar-aviso/90 text-white cursor-pointer"
            >
              {saving ? "Salvando..." : "Confirmar falta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cancelamento */}
      <Dialog
        open={action === "cancelled"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar cancelamento</DialogTitle>
            <DialogDescription>
              {appointment.patientName} — {dateFormatted} às {time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo *</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Selecione...</option>
                {CANCELLED_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleCancelled}
              disabled={saving}
              className="bg-cinza-texto hover:bg-cinza-texto/90 text-white cursor-pointer"
            >
              {saving ? "Salvando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Remarcação */}
      <Dialog
        open={action === "reschedule"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remarcar atendimento</DialogTitle>
            <DialogDescription>
              {appointment.patientName} — original: {dateFormatted} às {time}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nova data *</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    setConflictWarning("");
                  }}
                />
              </div>
              <div>
                <Label>Novo horário *</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => {
                    setNewTime(e.target.value);
                    setConflictWarning("");
                  }}
                  onBlur={checkConflict}
                />
              </div>
            </div>
            <div>
              <Label>Motivo *</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Selecione...</option>
                {RESCHEDULE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Detalhes adicionais..."
              />
            </div>
            {conflictWarning && (
              <div className="flex items-start gap-2 rounded-md bg-ambar-aviso/10 p-3 text-sm text-ambar-aviso">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{conflictWarning} Confirma mesmo assim?</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={saving}
              className="bg-verde-sucesso hover:bg-verde-sucesso/90 text-white cursor-pointer"
            >
              {saving ? "Salvando..." : "Confirmar remarcação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
