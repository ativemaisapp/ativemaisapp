import { createClient } from "@/lib/supabase/server";
import { PatientForm } from "@/components/gestao/patient-form";

export default async function NovoPacientePage() {
  const supabase = await createClient();

  const { data: fisios } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["gestao", "fisio"])
    .order("full_name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-tinta-texto">Novo paciente</h1>
      <PatientForm mode="create" fisios={fisios || []} />
    </div>
  );
}
