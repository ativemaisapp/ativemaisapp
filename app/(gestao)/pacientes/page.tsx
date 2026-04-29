import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Pacientes" };
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PatientFilters } from "@/components/gestao/patient-filters";
import { PatientTable } from "@/components/gestao/patient-table";

type SearchParams = Promise<{
  q?: string;
  fisio?: string;
  status?: string;
  freq?: string;
}>;

async function PatientList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();

  // Buscar fisios para o filtro
  const { data: fisios } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  // Query de pacientes com filtros
  let query = supabase
    .from("patients")
    .select(
      "id, full_name, birth_date, weekly_frequency, session_value, admission_date, status, primary_fisio_id, profiles!patients_primary_fisio_id_fkey(full_name)"
    )
    .order("full_name");

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status as "active" | "paused" | "discharged");
  } else if (!params.status) {
    // Default: mostrar apenas ativos
    query = query.eq("status", "active");
  }

  if (params.fisio) query = query.eq("primary_fisio_id", params.fisio);
  if (params.freq) query = query.eq("weekly_frequency", parseInt(params.freq));
  if (params.q) query = query.ilike("full_name", `%${params.q}%`);

  const { data: rawPatients } = await query;

  // Buscar última sessão de cada paciente
  const patientIds = (rawPatients || []).map((p) => p.id);
  const { data: lastSessions } = await supabase
    .from("appointments")
    .select("patient_id, scheduled_date")
    .eq("status", "completed")
    .in("patient_id", patientIds.length > 0 ? patientIds : ["__none__"])
    .order("scheduled_date", { ascending: false });

  const lastSessionMap = new Map<string, string>();
  (lastSessions || []).forEach((s) => {
    if (!lastSessionMap.has(s.patient_id)) {
      lastSessionMap.set(s.patient_id, s.scheduled_date);
    }
  });

  // Montar dados + ordenar por receita projetada desc
  const patients = (rawPatients || [])
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      birth_date: p.birth_date,
      weekly_frequency: p.weekly_frequency,
      session_value: p.session_value,
      admission_date: p.admission_date,
      status: p.status,
      fisioName:
        (p.profiles as unknown as { full_name: string })?.full_name || "—",
      lastSessionDate: lastSessionMap.get(p.id) || null,
      projectedRevenue:
        (p.weekly_frequency || 0) * 4.33 * (p.session_value || 0),
    }))
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue);

  // Contadores (buscar independente dos filtros)
  const { data: allPatients } = await supabase
    .from("patients")
    .select("status");

  const counts = {
    active: (allPatients || []).filter((p) => p.status === "active").length,
    paused: (allPatients || []).filter((p) => p.status === "paused").length,
    discharged: (allPatients || []).filter((p) => p.status === "discharged")
      .length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-tinta-texto">Pacientes</h1>
          <p className="text-sm text-cinza-texto">
            {counts.active} ativos · {counts.paused} em pausa ·{" "}
            {counts.discharged} desligados
          </p>
        </div>
        <Link href="/pacientes/novo">
          <Button className="bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer">
            <Plus className="mr-1 h-4 w-4" />
            Novo paciente
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <PatientFilters fisios={fisios || []} />

      {/* Tabela / Cards */}
      <PatientTable patients={patients} />
    </div>
  );
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-linha-suave" />
          <div className="h-10 w-full animate-pulse rounded bg-linha-suave" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded bg-linha-suave"
              />
            ))}
          </div>
        </div>
      }
    >
      <PatientList searchParams={searchParams} />
    </Suspense>
  );
}
