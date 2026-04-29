import type { Metadata } from "next";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Financeiro" };
import { formatCurrency } from "@/lib/utils";
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

  // Meses disponíveis
  const months = Array.from({ length: 13 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  // Queries paralelas
  const [
    activePatientsRes,
    completedAptsRes,
    allAptsRes,
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
    supabase
      .from("appointments")
      .select("patient_id, patients!inner(session_value, full_name)")
      .eq("status", "completed")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    supabase
      .from("appointments")
      .select("status, patient_id")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    supabase
      .from("profiles")
      .select("id, full_name, repasse_value, role")
      .eq("role", "fisio"),
    supabase
      .from("evolutions")
      .select("fisio_id")
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
  const completedApts = completedAptsRes.data || [];
  const allApts = allAptsRes.data || [];
  const fisios = fisiosRes.data || [];
  const evolutions = evolutionsRes.data || [];
  const billingStatuses = billingRes.data || [];
  const payrollStatuses = payrollRes.data || [];

  // KPI 1: Receita projetada
  const receitaProjetada = activePatients.reduce(
    (sum, p) => sum + (p.weekly_frequency || 0) * 4.33 * (p.session_value || 0),
    0
  );

  // KPI 2: Receita realizada + ticket médio
  const receitaRealizada = completedApts.reduce((sum, a) => {
    const sv = (a.patients as unknown as { session_value: number })?.session_value || 0;
    return sum + sv;
  }, 0);
  const completedCount = completedApts.length;
  const ticketMedio = completedCount > 0 ? receitaRealizada / completedCount : 0;
  const percentRealizada = receitaProjetada > 0 ? Math.round((receitaRealizada / receitaProjetada) * 100) : 0;

  // KPI 3: Repasses
  const evosByFisio: Record<string, number> = {};
  evolutions.forEach((e) => {
    evosByFisio[e.fisio_id] = (evosByFisio[e.fisio_id] || 0) + 1;
  });

  const repasseTotal = fisios.reduce((sum, f) => {
    const count = evosByFisio[f.id] || 0;
    return sum + count * (f.repasse_value || 0);
  }, 0);
  const fisiosComSessoes = fisios.filter((f) => (evosByFisio[f.id] || 0) > 0).length;

  // KPI 4: Lucro
  const lucro = receitaRealizada - repasseTotal;

  // Dados para tabela de cobranças
  const sessionsByPatient: Record<string, number> = {};
  completedApts.forEach((a) => {
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

  // Dados para tabela de repasses
  const payrollMap = new Map(payrollStatuses.map((p) => [p.fisio_id, p]));

  const payrollRows = fisios.map((f) => {
    const sessions = evosByFisio[f.id] || 0;
    const total = sessions * (f.repasse_value || 0);
    const payroll = payrollMap.get(f.id);
    return {
      fisioId: f.id,
      fisioName: f.full_name,
      sessions,
      repasseValue: f.repasse_value || 0,
      total,
      status: payroll?.status || "open",
      payrollId: payroll?.id || null,
      markedPaidAt: payroll?.marked_paid_at || null,
    };
  });

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
    />
  );
}
