"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SchedulePicker, type ScheduleEntry } from "@/components/gestao/schedule-picker";

const patientSchema = z.object({
  full_name: z.string().min(1, "Nome obrigatório"),
  birth_date: z.string().min(1, "Data de nascimento obrigatória"),
  cpf: z.string().optional(),
  address: z.string().min(1, "Endereço obrigatório"),
  phone: z.string().min(1, "Telefone obrigatório"),
  family_contact_name: z.string().min(1, "Nome do responsável obrigatório"),
  family_relationship: z.string().min(1, "Parentesco obrigatório"),
  family_phone: z.string().min(1, "Telefone do responsável obrigatório"),
  family_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  primary_fisio_id: z.string().min(1, "Fisioterapeuta obrigatória"),
  weekly_frequency: z.string().optional(),
  session_value: z.string().min(1, "Valor obrigatório"),
  admission_date: z.string().min(1, "Data de início obrigatória"),
  primary_diagnosis: z.string().min(1, "Diagnóstico obrigatório"),
  comorbidities: z.string().optional(),
  allergies: z.string().optional(),
  clinical_notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

type MedRow = { name: string; dosage: string; frequency: string; notes: string };

type Fisio = { id: string; full_name: string };

type Props = {
  mode: "create" | "edit";
  fisios: Fisio[];
  initialData?: Record<string, string | number | null | undefined> & { id?: string };
  initialMeds?: MedRow[];
  initialSchedule?: ScheduleEntry[];
};

const RELATIONSHIPS = [
  "Filho(a)", "Esposo(a)", "Cônjuge", "Cuidador profissional",
  "Sobrinho(a)", "Neto(a)", "Irmão(ã)", "Outro",
];

const DAY_MAP_LABELS: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};
const DAY_MAP_FALLBACK: Record<number, number[]> = {
  1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 3, 4],
  5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
};

function getDefaultSchedule(freq?: number | string | null): ScheduleEntry[] {
  const n = Number(freq) || 2;
  const days = DAY_MAP_FALLBACK[n] || [2, 4];
  return days.map((d) => ({ day: d, label: DAY_MAP_LABELS[d], time: "08:00" }));
}

export function PatientForm({ mode, fisios, initialData, initialMeds, initialSchedule }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meds, setMeds] = useState<MedRow[]>(initialMeds || []);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(
    initialSchedule || getDefaultSchedule(initialData?.weekly_frequency)
  );
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          weekly_frequency: String(initialData.weekly_frequency),
          session_value: String(initialData.session_value),
        }
      : {
          session_value: "190",
          admission_date: new Date().toISOString().split("T")[0],
          weekly_frequency: "2",
        },
  });

  function addMed() {
    setMeds((prev) => [...prev, { name: "", dosage: "", frequency: "", notes: "" }]);
  }

  function updateMed(index: number, field: keyof MedRow, value: string) {
    setMeds((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function removeMed(index: number) {
    setMeds((prev) => prev.filter((_, i) => i !== index));
  }

  const [pendingData, setPendingData] = useState<PatientFormData | null>(null);
  const [futureScheduledCount, setFutureScheduledCount] = useState(0);

  async function onSubmit(data: PatientFormData) {
    if (schedule.length === 0) {
      toast.error("Selecione ao menos um dia de atendimento");
      return;
    }
    if (mode === "edit") {
      // Contar appointments futuros que serão recriados
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", initialData?.id || "")
        .eq("status", "scheduled")
        .gte("scheduled_date", today);
      setFutureScheduledCount(count || 0);
      setPendingData(data);
      setShowScheduleConfirm(true);
      return;
    }
    doSubmit(data);
  }

  function confirmScheduleChange() {
    setShowScheduleConfirm(false);
    if (pendingData) doSubmit(pendingData);
  }

  async function doSubmit(data: PatientFormData) {
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "create") {
        // Criar paciente
        const freq = schedule.length;
        const ticket = parseFloat(data.session_value);

        const { data: newPatient, error } = await supabase
          .from("patients")
          .insert({
            full_name: data.full_name,
            birth_date: data.birth_date,
            cpf: data.cpf || null,
            address: data.address,
            phone: data.phone,
            family_contact_name: data.family_contact_name,
            family_relationship: data.family_relationship,
            family_phone: data.family_phone,
            family_email: data.family_email || null,
            primary_fisio_id: data.primary_fisio_id,
            weekly_frequency: freq,
            session_value: ticket,
            admission_date: data.admission_date,
            primary_diagnosis: data.primary_diagnosis,
            comorbidities: data.comorbidities || null,
            allergies: data.allergies || null,
            clinical_notes: data.clinical_notes || null,
            tcle_signed: true,
            tcle_signed_at: new Date().toISOString(),
            commitment_signed: true,
            status: "active" as const,
          })
          .select("id")
          .single();

        if (error || !newPatient) throw new Error(error?.message || "Erro ao criar paciente");

        // Inserir medicamentos
        const validMeds = meds.filter((m) => m.name.trim());
        if (validMeds.length > 0) {
          await supabase.from("medications").insert(
            validMeds.map((m) => ({
              patient_id: newPatient.id,
              name: m.name.trim(),
              dosage: m.dosage.trim() || null,
              frequency: m.frequency.trim() || null,
              notes: m.notes.trim() || null,
            }))
          );
        }

        // Gerar appointments para os próximos 30 dias
        await generateAppointments(supabase, newPatient.id, data.primary_fisio_id, schedule, data.admission_date);

        toast.success("Paciente cadastrado com sucesso");
        router.push(`/pacientes/${newPatient.id}`);
      } else {
        // Editar paciente
        const patientId = initialData?.id;
        if (!patientId) throw new Error("ID do paciente não encontrado");

        const { error } = await supabase
          .from("patients")
          .update({
            full_name: data.full_name,
            birth_date: data.birth_date,
            cpf: data.cpf || null,
            address: data.address,
            phone: data.phone,
            family_contact_name: data.family_contact_name,
            family_relationship: data.family_relationship,
            family_phone: data.family_phone,
            family_email: data.family_email || null,
            primary_fisio_id: data.primary_fisio_id,
            weekly_frequency: schedule.length,
            session_value: parseFloat(data.session_value),
            admission_date: data.admission_date,
            primary_diagnosis: data.primary_diagnosis,
            comorbidities: data.comorbidities || null,
            allergies: data.allergies || null,
            clinical_notes: data.clinical_notes || null,
          })
          .eq("id", patientId);

        if (error) throw new Error(error.message);

        // Recriar appointments futuros com novo schedule
        const today = new Date().toISOString().split("T")[0];
        await supabase
          .from("appointments")
          .delete()
          .eq("patient_id", patientId)
          .eq("status", "scheduled")
          .gte("scheduled_date", today);

        await generateAppointments(
          supabase,
          patientId,
          data.primary_fisio_id,
          schedule,
          today
        );

        toast.success("Paciente atualizado com sucesso");
        router.push(`/pacientes/${patientId}`);
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function FieldError({ message }: { message?: string }) {
    return message ? (
      <p className="mt-1 text-xs text-vermelho-alerta">{message}</p>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">
      {/* SEÇÃO 1 — Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
          <CardDescription>Informações de identificação do paciente</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input {...register("full_name")} placeholder="Nome completo do paciente" />
            <FieldError message={errors.full_name?.message} />
          </div>
          <div>
            <Label>Data de nascimento *</Label>
            <Input type="date" {...register("birth_date")} />
            <FieldError message={errors.birth_date?.message} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input {...register("cpf")} placeholder="000.000.000-00" />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço completo *</Label>
            <Textarea {...register("address")} placeholder="Rua, número, bairro, cidade" rows={2} />
            <FieldError message={errors.address?.message} />
          </div>
          <div>
            <Label>Telefone *</Label>
            <Input {...register("phone")} placeholder="(83) 99999-9999" />
            <FieldError message={errors.phone?.message} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2 — Contato da família */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato da família</CardTitle>
          <CardDescription>Responsável familiar ou cuidador</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Nome do responsável *</Label>
            <Input {...register("family_contact_name")} />
            <FieldError message={errors.family_contact_name?.message} />
          </div>
          <div>
            <Label>Parentesco *</Label>
            <select
              {...register("family_relationship")}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="">Selecione...</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <FieldError message={errors.family_relationship?.message} />
          </div>
          <div>
            <Label>Telefone do responsável *</Label>
            <Input {...register("family_phone")} placeholder="(83) 99999-9999" />
            <FieldError message={errors.family_phone?.message} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" {...register("family_email")} placeholder="email@exemplo.com" />
            <FieldError message={errors.family_email?.message} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Plano de atendimento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano de atendimento</CardTitle>
          <CardDescription>Configurações de frequência e valor</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Fisioterapeuta responsável *</Label>
            <select
              {...register("primary_fisio_id")}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="">Selecione...</option>
              {fisios.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name}</option>
              ))}
            </select>
            <FieldError message={errors.primary_fisio_id?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>Dias e horários dos atendimentos *</Label>
            <div className="mt-1.5">
              <SchedulePicker value={schedule} onChange={setSchedule} />
            </div>
            <p className="mt-1.5 text-xs text-cinza-texto">
              {schedule.length}x por semana
            </p>
          </div>
          <div>
            <Label>Valor por sessão (R$) *</Label>
            <Input type="number" step="0.01" {...register("session_value")} />
            <FieldError message={errors.session_value?.message} />
          </div>
          <div>
            <Label>Data de início *</Label>
            <Input type="date" {...register("admission_date")} />
            <FieldError message={errors.admission_date?.message} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 4 — Histórico médico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico médico</CardTitle>
          <CardDescription>Informações clínicas do paciente</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div>
            <Label>Diagnóstico principal *</Label>
            <Input {...register("primary_diagnosis")} placeholder="Ex: Doença de Parkinson" />
            <FieldError message={errors.primary_diagnosis?.message} />
          </div>
          <div>
            <Label>Comorbidades</Label>
            <Textarea {...register("comorbidities")} placeholder="Uma por linha" rows={3} />
          </div>
          <div>
            <Label>Alergias</Label>
            <Textarea {...register("allergies")} placeholder="Uma por linha" rows={2} />
          </div>
          <div>
            <Label>Observações clínicas</Label>
            <Textarea {...register("clinical_notes")} placeholder="Observações gerais..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 5 — Medicamentos */}
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medicamentos</CardTitle>
            <CardDescription>Medicamentos em uso (opcional)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {meds.map((med, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    placeholder="Nome *"
                    value={med.name}
                    onChange={(e) => updateMed(i, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Dosagem"
                    value={med.dosage}
                    onChange={(e) => updateMed(i, "dosage", e.target.value)}
                  />
                  <Input
                    placeholder="Frequência"
                    value={med.frequency}
                    onChange={(e) => updateMed(i, "frequency", e.target.value)}
                  />
                  <Input
                    placeholder="Observação"
                    value={med.notes}
                    onChange={(e) => updateMed(i, "notes", e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="mt-1 rounded p-1 text-cinza-texto hover:bg-vermelho-alerta/10 hover:text-vermelho-alerta cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addMed} className="cursor-pointer">
              <Plus className="mr-1 h-4 w-4" /> Adicionar medicamento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-linha-suave bg-white px-6 py-3 lg:left-60">
        <div className="mx-auto flex max-w-4xl justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer"
          >
            {loading
              ? "Salvando..."
              : mode === "create"
                ? "Cadastrar paciente"
                : "Salvar alterações"}
          </Button>
        </div>
      </div>
      {/* AlertDialog para confirmação de mudança de schedule no edit */}
      <AlertDialog open={showScheduleConfirm} onOpenChange={setShowScheduleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recriar agendamentos futuros?</AlertDialogTitle>
            <AlertDialogDescription>
              Você alterou os dias e horários de atendimento. Isso vai recriar os
              agendamentos futuros ({futureScheduledCount} agendamento
              {futureScheduledCount !== 1 ? "s" : ""}). Atendimentos já
              realizados ou em andamento não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmScheduleChange}
              className="bg-verde-ative hover:bg-verde-ative/90 cursor-pointer"
            >
              Confirmar e salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

// Gera appointments para os próximos 30 dias com dias/horários do schedule
async function generateAppointments(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  fisioId: string,
  schedule: ScheduleEntry[],
  startDate: string
) {
  const dayTimeMap = new Map(schedule.map((s) => [s.day, s.time]));
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  const appointments: Array<{
    patient_id: string;
    fisio_id: string;
    scheduled_date: string;
    scheduled_time: string;
    status: "scheduled";
  }> = [];

  const current = new Date(start);
  while (current <= end) {
    const time = dayTimeMap.get(current.getDay());
    if (time) {
      appointments.push({
        patient_id: patientId,
        fisio_id: fisioId,
        scheduled_date: current.toISOString().split("T")[0],
        scheduled_time: time,
        status: "scheduled",
      });
    }
    current.setDate(current.getDate() + 1);
  }

  if (appointments.length > 0) {
    await supabase.from("appointments").insert(appointments);
  }
}
