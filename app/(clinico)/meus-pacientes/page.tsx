import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus pacientes" };
import { MeusPacientesContent } from "@/components/fisio/meus-pacientes-content";

type SearchParams = Promise<{ q?: string }>;

export default async function MeusPacientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("patients")
    .select(
      "id, full_name, birth_date, weekly_frequency, primary_diagnosis, status"
    )
    .eq("primary_fisio_id", user!.id)
    .eq("status", "active")
    .order("full_name");

  if (params.q) query = query.ilike("full_name", `%${params.q}%`);

  const { data: patients } = await query;

  // Buscar última sessão de cada paciente feita por esta fisio
  const patientIds = (patients || []).map((p) => p.id);
  const { data: lastSessions } = await supabase
    .from("appointments")
    .select("patient_id, scheduled_date")
    .eq("status", "completed")
    .eq("fisio_id", user!.id)
    .in("patient_id", patientIds.length > 0 ? patientIds : ["__none__"])
    .order("scheduled_date", { ascending: false });

  const lastSessionMap = new Map<string, string>();
  (lastSessions || []).forEach((s) => {
    if (!lastSessionMap.has(s.patient_id)) {
      lastSessionMap.set(s.patient_id, s.scheduled_date);
    }
  });

  const patientsWithSession = (patients || []).map((p) => ({
    ...p,
    lastSessionDate: lastSessionMap.get(p.id) || null,
  }));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-tinta-texto">
          Meus pacientes
        </h1>
        <p className="text-sm text-cinza-texto">
          {patientsWithSession.length} {patientsWithSession.length === 1 ? "ativo" : "ativos"}
        </p>
      </div>
      <MeusPacientesContent
        patients={patientsWithSession}
        searchQuery={params.q || ""}
      />
    </div>
  );
}
