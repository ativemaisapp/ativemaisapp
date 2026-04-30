import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, CheckCircle2, Calendar, Users, Clock, Stethoscope, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };
import {
  format,
  startOfMonth,
  endOfMonth,
  subDays,
  subYears,
  differenceInDays,
} from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { profileAtendePacientes } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/gestao/kpi-card";
import { AttentionCard } from "@/components/gestao/attention-card";
import { ProductionChart } from "@/components/gestao/production-chart";
import { TopPatients } from "@/components/gestao/top-patients";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Timezone São Paulo para saudação
  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const hour = spNow.getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Período do mês corrente
  const monthStart = format(startOfMonth(spNow), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(spNow), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(spNow, 7), "yyyy-MM-dd");
  const dayOfMonth = spNow.getDate();

  // Buscar profile do usuário logado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const firstName = profile?.full_name.split(" ")[0] || "";

  // ── Verificar se profile atende pacientes ──
  const atendePacientes = await profileAtendePacientes(user!.id, supabase);

  // ── Query de appointments do dia (para card de atendimentos) ──
  let myTodayTotal = 0;
  let myTodayConcluidos = 0;
  let myTodayFaltas = 0;
  if (atendePacientes) {
    const { data: myAppts } = await supabase
      .from("appointments")
      .select("status, patients!inner(status)")
      .eq("fisio_id", user!.id)
      .eq("scheduled_date", format(spNow, "yyyy-MM-dd"))
      .neq("patients.status", "discharged");
    const realizaveis = myAppts?.filter((a) => a.status !== "cancelled") || [];
    myTodayTotal = realizaveis.length;
    myTodayConcluidos = realizaveis.filter((a) => a.status === "completed").length;
    myTodayFaltas = realizaveis.filter((a) => a.status === "missed").length;
  }

  // ── 5 queries em paralelo ──
  const monthRef = format(spNow, "yyyy-MM");

  const [
    activePatientsRes,
    completedMonthRes,
    allAppointmentsMonthRes,
    recentCompletedRes,
    monthEvolutionsRes,
    billingRes,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, full_name, weekly_frequency, session_value, admission_date, primary_fisio_id, profiles!patients_primary_fisio_id_fkey(full_name)"
      )
      .eq("status", "active"),
    supabase
      .from("appointments")
      .select("patient_id, patients!inner(session_value)")
      .eq("status", "completed")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    supabase
      .from("appointments")
      .select("status")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    supabase
      .from("appointments")
      .select("patient_id")
      .eq("status", "completed")
      .gte("scheduled_date", sevenDaysAgo),
    supabase
      .from("evolutions")
      .select(
        "fisio_id, profiles!evolutions_fisio_id_fkey(full_name), patients!inner(session_value)"
      )
      .gte("created_at", monthStart + "T00:00:00")
      .lte("created_at", monthEnd + "T23:59:59"),
    supabase
      .from("billing_status")
      .select("patient_id, status")
      .eq("reference_month", monthRef)
      .eq("status", "paid"),
  ]);

  const activePatients = activePatientsRes.data || [];
  const paidBilling = billingRes.data || [];
  const completedMonth = completedMonthRes.data || [];
  const allAppointmentsMonth = allAppointmentsMonthRes.data || [];
  const recentCompleted = recentCompletedRes.data || [];
  const monthEvolutions = monthEvolutionsRes.data || [];

  // ── KPI 1: Receita Projetada ──
  const receitaProjetada = activePatients.reduce(
    (sum, p) => sum + (p.weekly_frequency || 0) * 4.33 * (p.session_value || 0),
    0
  );

  // ── KPI 2: Receita Realizada ──
  const receitaRealizada = completedMonth.reduce((sum, a) => {
    const sv = (a.patients as unknown as { session_value: number })
      ?.session_value;
    return sum + (sv || 0);
  }, 0);

  const percentRealizada =
    receitaProjetada > 0
      ? Math.round((receitaRealizada / receitaProjetada) * 100)
      : 0;

  const receitaSubtitle =
    dayOfMonth <= 1 ? "—" : `${percentRealizada}% da projetada`;

  // ── KPI 3: Atendimentos do mês ──
  const completedCount = allAppointmentsMonth.filter(
    (a) => a.status === "completed"
  ).length;
  const totalCount = allAppointmentsMonth.length;
  const attendanceRate = totalCount > 0
    ? Math.round((completedCount / totalCount) * 1000) / 10
    : 0;

  // ── KPI 4: Pacientes ativos ──
  const totalActive = activePatients.length;
  const fiveYearsAgo = subYears(spNow, 5);
  const longTermCount = activePatients.filter(
    (p) => p.admission_date && new Date(p.admission_date) <= fiveYearsAgo
  ).length;

  const longTermSubtitle =
    longTermCount === 0
      ? "Nenhum há mais de 5 anos"
      : `${longTermCount} com mais de 5 anos na carteira`;

  // ── KPI 5: Cobrança em aberto ──
  const paidPatientIds = new Set(paidBilling.map((b) => b.patient_id));
  // Pacientes com sessões no mês mas sem billing paid
  const sessionsByPatient: Record<string, number> = {};
  completedMonth.forEach((a) => {
    sessionsByPatient[a.patient_id] = (sessionsByPatient[a.patient_id] || 0) + 1;
  });
  const openBillingPatients = activePatients.filter(
    (p) => (sessionsByPatient[p.id] || 0) > 0 && !paidPatientIds.has(p.id)
  );
  const cobrancaAberta = openBillingPatients.reduce(
    (sum, p) =>
      sum + (sessionsByPatient[p.id] || 0) * (p.session_value || 0),
    0
  );

  // ── Card Atenção ──
  const recentPatientIds = new Set(recentCompleted.map((a) => a.patient_id));
  const attentionPatients = activePatients
    .filter((p) => !recentPatientIds.has(p.id))
    .map((p) => {
      // Calcular dias sem atendimento (simplificado: desde 7 dias atrás)
      const fisioName =
        (p.profiles as unknown as { full_name: string })?.full_name || "—";
      return {
        id: p.id,
        full_name: p.full_name,
        fisioName,
        daysSince: differenceInDays(spNow, subDays(spNow, 0)), // placeholder
      };
    });

  // Recalcular daysSince com base nos appointments reais
  // Buscar última sessão de cada paciente que está nos alertas
  if (attentionPatients.length > 0) {
    const { data: lastSessions } = await supabase
      .from("appointments")
      .select("patient_id, scheduled_date")
      .eq("status", "completed")
      .in(
        "patient_id",
        attentionPatients.map((p) => p.id)
      )
      .order("scheduled_date", { ascending: false });

    const lastSessionMap = new Map<string, string>();
    (lastSessions || []).forEach((s) => {
      if (!lastSessionMap.has(s.patient_id)) {
        lastSessionMap.set(s.patient_id, s.scheduled_date);
      }
    });

    attentionPatients.forEach((p) => {
      const lastDate = lastSessionMap.get(p.id);
      p.daysSince = lastDate
        ? differenceInDays(spNow, new Date(lastDate))
        : 999;
    });
  }

  // Ordenar por mais dias sem atendimento (mais críticos primeiro)
  attentionPatients.sort((a, b) => b.daysSince - a.daysSince);

  // ── Gráfico de produção ──
  const productionMap: Record<
    string,
    { name: string; count: number; revenue: number }
  > = {};
  monthEvolutions.forEach((e) => {
    const id = e.fisio_id;
    const name =
      (e.profiles as unknown as { full_name: string })?.full_name || "?";
    const sv = (e.patients as unknown as { session_value: number })
      ?.session_value || 0;
    if (!productionMap[id]) {
      productionMap[id] = { name, count: 0, revenue: 0 };
    }
    productionMap[id].count++;
    productionMap[id].revenue += sv;
  });

  const productionData = Object.values(productionMap).sort(
    (a, b) => b.count - a.count
  );

  // ── Top 10 pacientes ──
  const topPatients = activePatients
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      fisioName:
        (p.profiles as unknown as { full_name: string })?.full_name || "—",
      weeklyFrequency: p.weekly_frequency || 0,
      sessionValue: p.session_value || 0,
      projectedRevenue:
        (p.weekly_frequency || 0) * 4.33 * (p.session_value || 0),
    }))
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-semibold text-tinta-texto">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-cinza-texto">
          Aqui está o panorama da Ative+60 hoje.
        </p>
      </div>

      {/* Card Atendimentos de hoje (só para quem atende) */}
      {atendePacientes && (
        <div className="rounded-lg border-l-4 border-verde-ative bg-verde-ative/8 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Stethoscope className="mt-0.5 h-8 w-8 shrink-0 text-verde-ative" />
              <div>
                <p className="text-lg font-semibold text-tinta-texto">
                  Atendimentos de hoje
                </p>
                <p className="text-sm text-cinza-texto">
                  {myTodayTotal === 0
                    ? "Voce nao tem atendimentos hoje."
                    : myTodayConcluidos + myTodayFaltas === myTodayTotal
                      ? myTodayFaltas === 0
                        ? `Todos os ${myTodayTotal} atendimentos de hoje foram concluidos.`
                        : `Atendimentos de hoje finalizados. ${myTodayConcluidos} concluido${myTodayConcluidos !== 1 ? "s" : ""}, ${myTodayFaltas} falta${myTodayFaltas !== 1 ? "s" : ""}.`
                      : myTodayConcluidos === 0 && myTodayFaltas === 0
                        ? `Voce tem ${myTodayTotal} atendimento${myTodayTotal > 1 ? "s" : ""} hoje.`
                        : myTodayFaltas > 0
                          ? `Voce tem ${myTodayTotal} atendimento${myTodayTotal > 1 ? "s" : ""} hoje. ${myTodayConcluidos} concluido${myTodayConcluidos !== 1 ? "s" : ""}, ${myTodayFaltas} falta${myTodayFaltas !== 1 ? "s" : ""}.`
                          : `Voce tem ${myTodayTotal} atendimento${myTodayTotal > 1 ? "s" : ""} hoje. ${myTodayConcluidos} ja concluido${myTodayConcluidos !== 1 ? "s" : ""}.`}
                </p>
              </div>
            </div>
            <Link href="/agenda" className="shrink-0">
              <Button className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer">
                Ver minha agenda
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Receita projetada"
          value={formatCurrency(receitaProjetada)}
          subtitle="se todas as sessões previstas forem realizadas"
          icon={TrendingUp}
          iconColor="text-verde-ative"
        />
        <KpiCard
          title="Receita realizada"
          value={formatCurrency(receitaRealizada)}
          subtitle={receitaSubtitle}
          icon={CheckCircle2}
          iconColor="text-verde-sucesso"
        />
        <KpiCard
          title="Atendimentos do mês"
          value={String(completedCount)}
          subtitle={`de ${totalCount} previstos · ${attendanceRate}% comparecimento`}
          icon={Calendar}
          iconColor="text-laranja-ative"
        />
        <KpiCard
          title="Pacientes ativos"
          value={String(totalActive)}
          subtitle={longTermSubtitle}
          icon={Users}
          iconColor="text-tinta-texto"
        />
        <KpiCard
          title="Cobrança em aberto"
          value={formatCurrency(cobrancaAberta)}
          subtitle={`${openBillingPatients.length} pacientes pendentes`}
          icon={Clock}
          iconColor="text-ambar-aviso"
        />
      </div>

      {/* Card de Atenção */}
      <AttentionCard patients={attentionPatients} />

      {/* Gráfico + Top Pacientes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Produção do mês por profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionChart data={productionData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top pacientes por receita projetada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TopPatients patients={topPatients} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
