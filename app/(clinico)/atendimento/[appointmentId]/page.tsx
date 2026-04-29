import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AtendimentoForm } from "@/components/fisio/atendimento-form";

type Props = { params: Promise<{ appointmentId: string }> };

export default async function AtendimentoPage({ params }: Props) {
  const { appointmentId } = await params;
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "*, patients!inner(full_name, address, primary_diagnosis, weekly_frequency)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) notFound();

  // Buscar evolução existente (se retomando atendimento in_progress)
  const { data: existingEvolution } = await supabase
    .from("evolutions")
    .select("*")
    .eq("appointment_id", appointmentId)
    .single();

  const patientData = appointment.patients as unknown as {
    full_name: string;
    address: string;
    primary_diagnosis: string;
  };

  return (
    <AtendimentoForm
      appointmentId={appointment.id}
      patientId={appointment.patient_id}
      fisioId={appointment.fisio_id}
      patientName={patientData.full_name}
      checkInAt={appointment.check_in_at}
      status={appointment.status}
      existingEvolution={
        existingEvolution
          ? {
              id: existingEvolution.id,
              bp_initial: existingEvolution.bp_initial || "",
              bp_final: existingEvolution.bp_final || "",
              hr_initial: existingEvolution.hr_initial?.toString() || "",
              hr_final: existingEvolution.hr_final?.toString() || "",
              spo2_initial: existingEvolution.spo2_initial?.toString() || "",
              spo2_final: existingEvolution.spo2_final?.toString() || "",
              rr_initial: existingEvolution.rr_initial?.toString() || "",
              rr_final: existingEvolution.rr_final?.toString() || "",
              conducts: existingEvolution.conducts || [],
              observations: existingEvolution.observations || "",
              had_intercurrence: existingEvolution.had_intercurrence || false,
              intercurrence_description:
                existingEvolution.intercurrence_description || "",
            }
          : null
      }
    />
  );
}
