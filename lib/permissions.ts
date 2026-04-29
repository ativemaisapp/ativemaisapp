import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifica se um profile aparece como atendente em pelo menos 1 paciente ou appointment.
 * Usado para decidir se a sidebar mostra "Minha agenda" e "Meus pacientes".
 */
export async function profileAtendePacientes(
  profileId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("primary_fisio_id", profileId)
    .limit(1);

  if (count && count > 0) return true;

  const { count: apptCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("fisio_id", profileId)
    .limit(1);

  return (apptCount ?? 0) > 0;
}
