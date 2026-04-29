import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductionChart } from "@/components/gestao/production-chart";

export const metadata: Metadata = { title: "Detalhe Profissional" };

type Props = { params: Promise<{ id: string }> };

export default async function FisioDetailPage({ params }: Props) {
  const { id: fisioId } = await params;
  const supabase = await createClient();

  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const sixMonthsAgo = format(subMonths(spNow, 6), "yyyy-MM-dd");
  const currentMonth = format(spNow, "yyyy-MM");

  const [profileRes, patientsRes, evolutionsRes, intercurrencesRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", fisioId).single(),
      supabase
        .from("patients")
        .select(
          "id, full_name, weekly_frequency, session_value, status, admission_date"
        )
        .eq("primary_fisio_id", fisioId)
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("evolutions")
        .select(
          "created_at, appointments!inner(patients!inner(session_value))"
        )
        .eq("fisio_id", fisioId)
        .gte("created_at", sixMonthsAgo + "T00:00:00"),
      supabase
        .from("evolutions")
        .select(
          "id, patient_id, created_at, intercurrence_description, patients!inner(full_name)"
        )
        .eq("fisio_id", fisioId)
        .eq("had_intercurrence", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!profileRes.data) notFound();
  const profile = profileRes.data;

  // ── Caso especial: profile que não atende pacientes (ex: Guilherme) ──
  const patients = patientsRes.data || [];
  const evolutions = evolutionsRes.data || [];
  const hasClinic = patients.length > 0 || evolutions.length > 0;

  if (!hasClinic) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <Link
          href="/equipe"
          className="inline-flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para equipe
        </Link>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-creme-fundo">
            <UserCircle className="h-12 w-12 text-cinza-texto" />
          </div>
          <h1 className="text-2xl font-semibold text-tinta-texto">
            {profile.full_name}
          </h1>
          <Badge className="bg-laranja-ative text-white hover:bg-laranja-ative/90">
            Tech Lead DOM
          </Badge>
          <p className="text-cinza-texto">
            Este perfil não atende pacientes.
          </p>
        </div>
      </div>
    );
  }

  // ── Gráfico de produção 6 meses ──
  const monthBuckets: Record<string, { count: number; revenue: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const key = format(subMonths(spNow, i), "yyyy-MM");
    monthBuckets[key] = { count: 0, revenue: 0 };
  }

  evolutions.forEach((e) => {
    const key = e.created_at.slice(0, 7);
    if (monthBuckets[key]) {
      monthBuckets[key].count++;
      const sv =
        (
          e.appointments as unknown as {
            patients: { session_value: number };
          }
        )?.patients?.session_value ?? 0;
      monthBuckets[key].revenue += sv;
    }
  });

  const productionData = Object.entries(monthBuckets).map(([month, data]) => ({
    name: format(new Date(month + "-15"), "MMM/yy", { locale: ptBR }),
    count: data.count,
    revenue: data.revenue,
  }));

  // ── Repasse do mês corrente ──
  const currentMonthEvos = evolutions.filter((e) =>
    e.created_at.startsWith(currentMonth)
  ).length;
  const repasseValue = profile.repasse_value || 0;
  const valorReceber = currentMonthEvos * repasseValue;

  // ── Intercorrências ──
  const intercurrences = (intercurrencesRes.data || []).map((e) => ({
    id: e.id,
    date: e.created_at,
    patientName:
      (e.patients as unknown as { full_name: string })?.full_name || "—",
    description: e.intercurrence_description || "Sem descrição",
  }));

  const roleBadge =
    profile.role === "gestao" ? (
      <Badge className="bg-verde-ative text-white hover:bg-verde-ative/90">
        Sócia-administradora
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-cinza-texto">
        Fisioterapeuta
      </Badge>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/equipe"
          className="mb-4 inline-flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para equipe
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-creme-fundo">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <UserCircle className="h-10 w-10 text-cinza-texto" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-tinta-texto">
              {profile.full_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-cinza-texto">
              {profile.crefito && <span>CREFITO {profile.crefito}</span>}
              {roleBadge}
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-cinza-texto">
              {profile.email && <span>{profile.email}</span>}
              {profile.phone && <span>{profile.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-semibold text-tinta-texto">
              {patients.length}
            </p>
            <p className="text-sm text-cinza-texto">Pacientes ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-semibold text-tinta-texto">
              {currentMonthEvos}
            </p>
            <p className="text-sm text-cinza-texto">Sessões este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-semibold text-verde-ative">
              {formatCurrency(valorReceber)}
            </p>
            <p className="text-sm text-cinza-texto">
              Valor a receber ({currentMonthEvos} x{" "}
              {formatCurrency(repasseValue)})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico + Intercorrências */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Produção dos últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionChart data={productionData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Intercorrências reportadas ({intercurrences.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intercurrences.length === 0 ? (
              <p className="py-4 text-center text-sm text-cinza-texto">
                Nenhuma intercorrência reportada.
              </p>
            ) : (
              intercurrences.map((ic) => (
                <div
                  key={ic.id}
                  className="rounded-md border-l-4 border-l-vermelho-alerta bg-vermelho-alerta/5 p-3"
                >
                  <div className="flex justify-between text-xs text-cinza-texto">
                    <span>{ic.patientName}</span>
                    <span>
                      {format(new Date(ic.date), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-tinta-texto">
                    {ic.description}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de pacientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pacientes ({patients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patients.length === 0 ? (
            <p className="py-4 text-center text-sm text-cinza-texto">
              Nenhum paciente ativo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Valor/sessão</TableHead>
                  <TableHead>Na Ative desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/pacientes/${p.id}`}
                        className="text-verde-ative hover:underline"
                      >
                        {p.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{p.weekly_frequency}x/sem</TableCell>
                    <TableCell>
                      {formatCurrency(p.session_value || 0)}
                    </TableCell>
                    <TableCell>
                      {p.admission_date
                        ? format(new Date(p.admission_date), "dd/MM/yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
