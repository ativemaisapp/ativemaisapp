import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  differenceInYears,
  differenceInMonths,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PatientTabs } from "@/components/gestao/patient-tabs";
import { PatientStatusActions } from "@/components/gestao/patient-status-actions";

const STATUS_MAP = {
  active: { label: "Ativo", className: "bg-verde-sucesso/15 text-verde-sucesso border-transparent" },
  paused: { label: "Pausado", className: "bg-ambar-aviso/15 text-ambar-aviso border-transparent" },
  discharged: { label: "Alta", className: "bg-cinza-texto/15 text-cinza-texto border-transparent" },
};

type Props = { params: Promise<{ id: string }> };

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch tudo em paralelo
  const [patientRes, medsRes, evolutionsRes, examsRes, nextApptRes, reportsRes] =
    await Promise.all([
      supabase
        .from("patients")
        .select(
          "*, profiles!patients_primary_fisio_id_fkey(full_name)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("medications")
        .select("*")
        .eq("patient_id", id)
        .order("name"),
      supabase
        .from("evolutions")
        .select(
          "*, profiles!evolutions_fisio_id_fkey(full_name)"
        )
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("exams")
        .select("*")
        .eq("patient_id", id)
        .order("exam_date", { ascending: false }),
      supabase
        .from("appointments")
        .select("scheduled_date, scheduled_time")
        .eq("patient_id", id)
        .eq("status", "scheduled")
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .order("scheduled_date")
        .limit(1),
      supabase
        .from("monthly_reports")
        .select("*")
        .eq("patient_id", id)
        .order("reference_month", { ascending: false }),
    ]);

  if (!patientRes.data) notFound();

  const patient = patientRes.data;
  const medications = medsRes.data || [];
  const evolutions = (evolutionsRes.data || []).map((e) => ({
    ...e,
    fisioName:
      (e.profiles as unknown as { full_name: string })?.full_name || "—",
  }));
  const exams = examsRes.data || [];
  const reports = reportsRes.data || [];
  const nextAppt = nextApptRes.data?.[0] || null;

  const fisioName =
    (patient.profiles as unknown as { full_name: string })?.full_name || "—";
  const age = patient.birth_date
    ? differenceInYears(new Date(), new Date(patient.birth_date))
    : null;
  const status = STATUS_MAP[patient.status as keyof typeof STATUS_MAP];

  // Tempo na carteira
  let timeInPortfolio = "—";
  if (patient.admission_date) {
    const adm = new Date(patient.admission_date);
    const years = differenceInYears(new Date(), adm);
    const months = differenceInMonths(new Date(), adm) % 12;
    timeInPortfolio =
      years > 0 ? `${years} anos e ${months} meses` : `${months} meses`;
  }

  // Próximo atendimento
  let nextApptText = "Sem agendamento";
  if (nextAppt) {
    const d = new Date(nextAppt.scheduled_date + "T12:00:00");
    nextApptText = format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });
    if (nextAppt.scheduled_time) {
      nextApptText += ` às ${nextAppt.scheduled_time.slice(0, 5)}`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/pacientes"
            className="mb-2 inline-flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <h1 className="text-[28px] font-semibold leading-tight text-tinta-texto">
            {patient.full_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-cinza-texto">
            {age && <span>{age} anos</span>}
            <span>·</span>
            <span>{fisioName}</span>
            <Badge className={status.className}>{status.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/pacientes/${id}/editar`}>
            <Button
              variant="outline"
              className="border-verde-ative text-verde-ative hover:bg-verde-ative/5 cursor-pointer"
            >
              <Pencil className="mr-1 h-4 w-4" /> Editar
            </Button>
          </Link>
          <Link href={`/pacientes/${id}/relatorio`}>
            <Button className="bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer">
              Gerar relatório mensal
            </Button>
          </Link>
          <PatientStatusActions
            patientId={id}
            patientName={patient.full_name}
            status={patient.status as "active" | "paused" | "discharged"}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
              Frequência
            </p>
            <p className="mt-1 text-lg font-semibold text-tinta-texto">
              {patient.weekly_frequency}x por semana
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
              Ticket
            </p>
            <p className="mt-1 text-lg font-semibold text-tinta-texto">
              {formatCurrency(patient.session_value || 0)} por sessão
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
              Na Ative
            </p>
            <p className="mt-1 text-lg font-semibold text-tinta-texto">
              {timeInPortfolio}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
              Próximo atendimento
            </p>
            <p className="mt-1 text-sm font-semibold text-tinta-texto">
              {nextApptText}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <PatientTabs
        patient={patient}
        medications={medications}
        evolutions={evolutions}
        exams={exams}
        reports={reports}
      />
    </div>
  );
}
