import type { Metadata } from "next";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Agenda" };
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { AgendaContent } from "@/components/fisio/agenda-content";

type SearchParams = Promise<{ data?: string }>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  // Saudação
  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const hour = spNow.getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.full_name.split(" ")[0] || "";

  // Data selecionada
  const selectedDate = params.data || format(spNow, "yyyy-MM-dd");
  const isToday = selectedDate === format(spNow, "yyyy-MM-dd");
  const dateLabel = format(
    new Date(selectedDate + "T12:00:00"),
    "EEEE, d 'de' MMMM",
    { locale: ptBR }
  );

  // Buscar appointments do dia
  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_date, scheduled_time, check_in_at, check_out_at, status, reschedule_reason, reschedule_notes, rescheduled_to, patient_id, patients!inner(full_name, address, weekly_frequency, phone, status)"
    )
    .eq("fisio_id", user!.id)
    .eq("scheduled_date", selectedDate)
    .neq("patients.status", "discharged")
    .order("scheduled_time");

  const appts = (appointments || []).map((a) => ({
    id: a.id,
    scheduledTime: a.scheduled_time,
    checkInAt: a.check_in_at,
    checkOutAt: a.check_out_at,
    status: a.status,
    rescheduleReason: a.reschedule_reason,
    rescheduleNotes: a.reschedule_notes,
    rescheduledTo: a.rescheduled_to,
    patientId: a.patient_id,
    patientName: (a.patients as unknown as { full_name: string })?.full_name || "—",
    address: (a.patients as unknown as { address: string })?.address || "",
    weeklyFrequency: (a.patients as unknown as { weekly_frequency: number })?.weekly_frequency || 0,
  }));

  const completedCount = appts.filter((a) => a.status === "completed").length;
  const pendingCount = appts.filter(
    (a) => a.status === "scheduled" || a.status === "in_progress"
  ).length;
  const missedCount = appts.filter((a) => a.status === "missed").length;
  const cancelledCount = appts.filter((a) => a.status === "cancelled").length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-semibold text-tinta-texto">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm capitalize text-cinza-texto">{dateLabel}</p>
      </div>

      <AgendaContent
        appointments={appts}
        selectedDate={selectedDate}
        isToday={isToday}
        totalCount={appts.length}
        completedCount={completedCount}
        pendingCount={pendingCount}
        missedCount={missedCount}
        cancelledCount={cancelledCount}
        fisioId={user!.id}
      />
    </div>
  );
}
