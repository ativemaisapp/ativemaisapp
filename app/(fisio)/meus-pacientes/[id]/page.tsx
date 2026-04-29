import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { differenceInYears, format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientTabs } from "@/components/gestao/patient-tabs";

type Props = { params: Promise<{ id: string }> };

export default async function FisioPatientDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [patientRes, medsRes, evolutionsRes, examsRes, todayApptRes] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("medications")
        .select("*")
        .eq("patient_id", id)
        .order("name"),
      supabase
        .from("evolutions")
        .select("*, profiles!evolutions_fisio_id_fkey(full_name)")
        .eq("patient_id", id)
        .eq("fisio_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("exams")
        .select("*")
        .eq("patient_id", id)
        .order("exam_date", { ascending: false }),
      supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", id)
        .eq("fisio_id", user!.id)
        .eq("status", "scheduled")
        .eq("scheduled_date", new Date().toISOString().split("T")[0])
        .limit(1),
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
  const todayAppt = todayApptRes.data?.[0] || null;

  const age = patient.birth_date
    ? differenceInYears(new Date(), new Date(patient.birth_date))
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header */}
      <Link
        href="/meus-pacientes"
        className="inline-flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-tinta-texto">
          {patient.full_name}
        </h1>
        <p className="text-sm text-cinza-texto">
          {age && `${age} anos · `}
          {patient.weekly_frequency}x por semana ·{" "}
          {patient.primary_diagnosis}
        </p>
      </div>

      {/* Botão iniciar atendimento (se tem appointment hoje) */}
      {todayAppt && (
        <Link href={`/atendimento/${todayAppt.id}`}>
          <Button className="h-12 w-full bg-verde-ative hover:bg-verde-ative/90 text-white text-base cursor-pointer">
            Iniciar atendimento de hoje
          </Button>
        </Link>
      )}

      {/* Tabs (reutiliza componente da gestão) */}
      <PatientTabs
        patient={patient}
        medications={medications}
        evolutions={evolutions}
        exams={exams}
      />
    </div>
  );
}
