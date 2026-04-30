import type { Metadata } from "next";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { isAppointmentBillable, isAppointmentPayable, isEvolutionComplete } from "@/lib/evolution-rules";

export const metadata: Metadata = { title: "Financeiro" };
import { FinanceiroContent } from "@/components/gestao/financeiro-content";

type SearchParams = Promise<{ mes?: string }>;

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();

  const selectedMonth = params.mes || format(now, "yyyy-MM");
  const monthDate = new Date(selectedMonth + "-15");
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  // Mês anterior para comparativo de taxa
  const prevMonthDate = subMonths(monthDate, 1);
  const prevMonthStart = format(startOfMonth(prevMonthDate), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(prevMonthDate), "yyyy-MM-dd");

  const months = Array.from({ length: 13 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  const [
    activePatientsRes,
    billableAptsRes,
    allAptsRes,
    prevAllAptsRes,
    fisiosRes,
    evolutionsRes,
    billingRes,
    payrollRes,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, full_name, weekly_frequency, session_value, primary_fisio_id, profiles!patients_primary_fisio_id_fkey(full_name)"
      )
      .eq("status", "active"),
    // Appointments billable (completed + missed) do mês
    supabase
      .from("appointments")
      .select("patient_id, status, patients!inner(session_value, full_name)")
      .in("status", ["completed", "missed"])
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    // Todos appointments do mês (para auditoria)
    supabase
      .from("appointments")
      .select("id, status, patient_id, fisio_id, reschedule_reason, patients!inner(full_name)")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    // Mês anterior (para taxa comparativa)
    supabase
      .from("appointments")
      .select("status")
      .gte("scheduled_date", prevMonthStart)
      .lte("scheduled_date", prevMonthEnd),
    supabase
      .from("profiles")
      .select("id, full_name, repasse_value, role")
      .in("role", ["fisio", "gestao"]),
    // Evoluções com dados completos para isEvolutionComplete
    supabase
      .from("evolutions")
      .select("fisio_id, bp_initial, bp_final, hr_initial, hr_final, spo2_initial, spo2_final, rr_initial, rr_final, conducts, had_intercurrence, intercurrence_description, appointments!inner(status)")
      .gte("created_at", monthStart + "T00:00:00")
      .lte("created_at", monthEnd + "T23:59:59"),
    supabase
      .from("billing_status")
      .select("*")
      .eq("reference_month", selectedMonth),
    supabase
      .from("payroll_status")
      .select("*")
      .eq("reference_month", selectedMonth),
  ]);

  const activePatients = activePatientsRes.data || [];
  const billableApts = billableAptsRes.data || [];
  const allApts = allAptsRes.data || [];
  const prevAllApts = prevAllAptsRes.data || [];
  const fisios = fisiosRes.data || [];
  const evolutions = evolutionsRes.data || [];
  const billingStatuses = billingRes.data || [];
  const payrollStatuses = payrollRes.data || [];

  // KPI 1: Receita projetada
  const receitaProjetada = activePatients.reduce(
    (sum, p) => sum + (p.weekly_frequency || 0) * 4.33 * (p.session_value || 0),
    0
  );

  // KPI 2: Receita realizada (completed + missed)
  const receitaRealizada = billableApts.reduce((sum, a) => {
    const sv = (a.patients as unknown as { session_value: number })?.session_value || 0;
    return sum + sv;
  }, 0);
  const completedCount = billableApts.filter((a) => a.status === "completed").length;
  const ticketMedio = completedCount > 0 ? receitaRealizada / completedCount : 0;
  const percentRealizada = receitaProjetada > 0 ? Math.round((receitaRealizada / receitaProjetada) * 100) : 0;

  // KPI 3: Repasses (usando política isAppointmentPayable)
  const payableByFisio: Record<string, { total: number; qualified: number }> = {};
  evolutions.forEach((e) => {
    const fid = e.fisio_id;
    if (!payableByFisio[fid]) payableByFisio[fid] = { total: 0, qualified: 0 };
    payableByFisio[fid].total++;
    const apptStatus = (e.appointments as unknown as { status: string })?.status;
    if (isAppointmentPayable({ status: apptStatus || "" }, e as any)) {
      payableByFisio[fid].qualified++;
    }
  });

  // Adicionar missed appointments (fisio cumpriu deslocamento, sem evolução)
  const missedByFisio: Record<string, number> = {};
  allApts.filter((a) => a.status === "missed").forEach((a) => {
    missedByFisio[a.fisio_id] = (missedByFisio[a.fisio_id] || 0) + 1;
  });

  const repasseTotal = fisios.reduce((sum, f) => {
    const qualifiedEvos = payableByFisio[f.id]?.qualified || 0;
    const missedAppts = missedByFisio[f.id] || 0;
    return sum + (qualifiedEvos + missedAppts) * (f.repasse_value || 0);
  }, 0);
  const fisiosComSessoes = fisios.filter(
    (f) => (payableByFisio[f.id]?.total || 0) > 0 || (missedByFisio[f.id] || 0) > 0
  ).length;

  // KPI 4: Lucro
  const lucro = receitaRealizada - repasseTotal;

  // Tabela de cobranças (billable: completed + missed)
  const sessionsByPatient: Record<string, number> = {};
  billableApts.forEach((a) => {
    sessionsByPatient[a.patient_id] = (sessionsByPatient[a.patient_id] || 0) + 1;
  });

  const billingMap = new Map(billingStatuses.map((b) => [b.patient_id, b]));

  const billingRows = activePatients
    .filter((p) => (sessionsByPatient[p.id] || 0) > 0)
    .map((p) => {
      const sessions = sessionsByPatient[p.id] || 0;
      const valor = sessions * (p.session_value || 0);
      const billing = billingMap.get(p.id);
      return {
        patientId: p.id,
        patientName: p.full_name,
        fisioName: (p.profiles as unknown as { full_name: string })?.full_name || "—",
        frequency: p.weekly_frequency || 0,
        sessions,
        valor,
        status: billing?.status || "open",
        billingId: billing?.id || null,
        markedPaidAt: billing?.marked_paid_at || null,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  // Tabela de repasses com % qualificado
  const payrollMap = new Map(payrollStatuses.map((p) => [p.fisio_id, p]));

  const payrollRows = fisios.map((f) => {
    const evoData = payableByFisio[f.id] || { total: 0, qualified: 0 };
    const missed = missedByFisio[f.id] || 0;
    const payableSessions = evoData.qualified + missed;
    const total = payableSessions * (f.repasse_value || 0);
    const payroll = payrollMap.get(f.id);
    const denominator = evoData.total + missed;
    return {
      fisioId: f.id,
      fisioName: f.full_name,
      sessions: payableSessions,
      repasseValue: f.repasse_value || 0,
      total,
      status: payroll?.status || "open",
      payrollId: payroll?.id || null,
      markedPaidAt: payroll?.marked_paid_at || null,
      qualifiedRatio: denominator > 0 ? `${payableSessions}/${denominator}` : "—",
      qualifiedPct: denominator > 0 ? Math.round((payableSessions / denominator) * 100) : 100,
    };
  });

  // Dados de auditoria
  const auditPlanned = allApts.length;
  const auditCompleted = allApts.filter((a) => a.status === "completed").length;
  const auditMissed = allApts.filter((a) => a.status === "missed").length;
  const auditCancelled = allApts.filter((a) => a.status === "cancelled").length;

  // Receita planejada do mês (baseada nos appointments planejados)
  const receitaPlanejadaMes = allApts.reduce((sum, a) => {
    const sv = activePatients.find((p) => p.id === a.patient_id)?.session_value || 0;
    return sum + sv;
  }, 0);

  // Taxa mês anterior
  const prevCompleted = prevAllApts.filter((a) => a.status === "completed").length;
  const prevPlanned = prevAllApts.length;
  const prevMonthRate = prevPlanned > 0
    ? Math.round((prevCompleted / prevPlanned) * 1000) / 10
    : null;

  // Quebra por motivo
  const reasonCounts: Record<string, { category: string; count: number }> = {};
  allApts
    .filter((a) => a.status === "missed" || a.status === "cancelled")
    .forEach((a) => {
      const reason = a.reschedule_reason || "Sem motivo registrado";
      const category = a.status === "missed" ? "Falta" : "Cancelamento";
      const key = `${category}:${reason}`;
      if (!reasonCounts[key]) reasonCounts[key] = { category, count: 0 };
      reasonCounts[key].count++;
    });

  const reasonBreakdown = Object.entries(reasonCounts)
    .map(([key, val]) => ({
      reason: key.split(":").slice(1).join(":"),
      category: val.category,
      count: val.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Top pacientes com mais não-comparecimento
  const absentByPatient: Record<string, { name: string; missed: number; cancelled: number }> = {};
  allApts
    .filter((a) => a.status === "missed" || a.status === "cancelled")
    .forEach((a) => {
      if (!absentByPatient[a.patient_id]) {
        const name = (a.patients as unknown as { full_name: string })?.full_name || "—";
        absentByPatient[a.patient_id] = { name, missed: 0, cancelled: 0 };
      }
      if (a.status === "missed") absentByPatient[a.patient_id].missed++;
      else absentByPatient[a.patient_id].cancelled++;
    });

  const topAbsent = Object.entries(absentByPatient)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => (b.missed + b.cancelled) - (a.missed + a.cancelled))
    .slice(0, 5)
    .filter((p) => p.missed + p.cancelled > 0);

  return (
    <FinanceiroContent
      selectedMonth={selectedMonth}
      months={months}
      kpis={{
        receitaProjetada,
        receitaRealizada,
        percentRealizada,
        ticketMedio,
        repasseTotal,
        fisiosComSessoes,
        lucro,
      }}
      billingRows={billingRows}
      payrollRows={payrollRows}
      auditData={{
        planned: auditPlanned,
        completed: auditCompleted,
        missed: auditMissed,
        cancelled: auditCancelled,
        receitaPlanejada: receitaPlanejadaMes,
        receitaRealizada,
        prevMonthRate,
        reasonBreakdown,
        topAbsent,
      }}
    />
  );
}
