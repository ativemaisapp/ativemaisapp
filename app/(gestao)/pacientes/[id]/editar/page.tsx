import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PatientForm } from "@/components/gestao/patient-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditarPacientePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [patientRes, fisiosRes, medsRes] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).single(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["gestao", "fisio"])
      .order("full_name"),
    supabase
      .from("medications")
      .select("name, dosage, frequency, notes")
      .eq("patient_id", id),
  ]);

  if (!patientRes.data) notFound();

  const p = patientRes.data;

  const initialData = {
    id: p.id,
    full_name: p.full_name,
    birth_date: p.birth_date || "",
    cpf: p.cpf || "",
    address: p.address || "",
    phone: p.phone || "",
    family_contact_name: p.family_contact_name || "",
    family_relationship: p.family_relationship || "",
    family_phone: p.family_phone || "",
    family_email: p.family_email || "",
    primary_fisio_id: p.primary_fisio_id || "",
    weekly_frequency: p.weekly_frequency || 2,
    session_value: p.session_value || 190,
    admission_date: p.admission_date || "",
    primary_diagnosis: p.primary_diagnosis || "",
    comorbidities: p.comorbidities || "",
    allergies: p.allergies || "",
    clinical_notes: p.clinical_notes || "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-tinta-texto">
        Editar paciente · {p.full_name}
      </h1>
      <PatientForm
        mode="edit"
        fisios={fisiosRes.data || []}
        initialData={initialData}
        initialMeds={(medsRes.data || []).map((m) => ({
          name: m.name,
          dosage: m.dosage || "",
          frequency: m.frequency || "",
          notes: m.notes || "",
        }))}
      />
    </div>
  );
}
