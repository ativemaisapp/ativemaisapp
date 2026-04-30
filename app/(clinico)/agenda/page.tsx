import type { Metadata } from "next";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Agenda" };
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AgendaContent } from "@/components/fisio/agenda-content";

type SearchParams = Promise<{ data?: string; view?: string }>;

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
    .select("full_name, role")
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

  // View mode
  const viewMode = params.view === "semana" ? "semana" : "dia";

  // Calcular semana (segunda a domingo)
  const selectedDateObj = new Date(selectedDate + "T12:00:00");
  const dayOfWeek = selectedDateObj.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(selectedDateObj);
  weekStartDate.setDate(weekStartDate.getDate() + mondayOffset);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const weekStartStr = format(weekStartDate, "yyyy-MM-dd");
  const weekEndStr = format(weekEndDate, "yyyy-MM-dd");

  // Buscar appointments do dia
  const { data: dayAppointments } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_date, scheduled_time, check_in_at, check_out_at, status, reschedule_reason, reschedule_notes, rescheduled_to, patient_id, fisio_id, patients!inner(full_name, address, weekly_frequency, phone, status)"
    )
    .eq("fisio_id", user!.id)
    .eq("scheduled_date", selectedDate)
    .neq("patients.status", "discharged")
    .order("scheduled_time");

  // Buscar appointments da semana inteira
  const { data: weekAppointments } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_date, scheduled_time, check_in_at, check_out_at, status, reschedule_reason, reschedule_notes, rescheduled_to, patient_id, fisio_id, patients!inner(full_name, address, weekly_frequency, phone, status)"
    )
    .eq("fisio_id", user!.id)
    .gte("scheduled_date", weekStartStr)
    .lte("scheduled_date", weekEndStr)
    .neq("patients.status", "discharged")
    .order("scheduled_time");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapAppt(a: any) {
    return {
      id: a.id,
      scheduledDate: a.scheduled_date,
      scheduledTime: a.scheduled_time,
      checkInAt: a.check_in_at,
      checkOutAt: a.check_out_at,
      status: a.status,
      rescheduleReason: a.reschedule_reason,
      rescheduleNotes: a.reschedule_notes,
      rescheduledTo: a.rescheduled_to,
      patientId: a.patient_id,
      fisioId: a.fisio_id,
      patientName: (a.patients as unknown as { full_name: string })?.full_name || "—",
      address: (a.patients as unknown as { address: string })?.address || "",
      weeklyFrequency: (a.patients as unknown as { weekly_frequency: number })?.weekly_frequency || 0,
    };
  }

  const appts = (dayAppointments || []).map(mapAppt);
  const weekAppts = (weekAppointments || []).map(mapAppt);

  const completedCount = appts.filter((a) => a.status === "completed").length;
  const pendingCount = appts.filter(
    (a) => a.status === "scheduled" || a.status === "in_progress"
  ).length;
  const missedCount = appts.filter((a) => a.status === "missed").length;
  const cancelledCount = appts.filter((a) => a.status === "cancelled").length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header com saudação + toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-tinta-texto">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm capitalize text-cinza-texto">{dateLabel}</p>
        </div>
        <ViewToggle currentView={viewMode} selectedDate={selectedDate} />
      </div>

      <AgendaContent
        appointments={appts}
        allWeekAppointments={weekAppts}
        selectedDate={selectedDate}
        isToday={isToday}
        totalCount={appts.length}
        completedCount={completedCount}
        pendingCount={pendingCount}
        missedCount={missedCount}
        cancelledCount={cancelledCount}
        fisioId={user!.id}
        userRole={profile?.role || "fisio"}
        viewMode={viewMode}
        weekStartDate={weekStartDate.toISOString()}
      />
    </div>
  );
}

function ViewToggle({
  currentView,
  selectedDate,
}: {
  currentView: string;
  selectedDate: string;
}) {
  return (
    <div className="flex rounded-lg border border-linha-suave bg-white p-0.5">
      <a
        href={`/agenda?data=${selectedDate}&view=dia`}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          currentView === "dia"
            ? "bg-verde-ative text-white"
            : "text-cinza-texto hover:text-tinta-texto"
        )}
      >
        Dia
      </a>
      <a
        href={`/agenda?data=${selectedDate}&view=semana`}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          currentView === "semana"
            ? "bg-verde-ative text-white"
            : "text-cinza-texto hover:text-tinta-texto"
        )}
      >
        Semana
      </a>
    </div>
  );
}
