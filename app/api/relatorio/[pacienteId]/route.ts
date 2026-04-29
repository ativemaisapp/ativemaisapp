import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  format,
  startOfMonth,
  endOfMonth,
  differenceInYears,
  differenceInMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { ReportDocument, type ReportData } from "@/lib/pdf/report-template";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pacienteId: string }> }
) {
  const { pacienteId } = await params;
  const mes =
    request.nextUrl.searchParams.get("mes") ||
    format(new Date(), "yyyy-MM");

  const supabase = await createClient();

  // Verificar autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Datas do mês
  const monthDate = new Date(mes + "-15");
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });

  // Queries paralelas
  const [patientRes, evolutionsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "*, profiles!patients_primary_fisio_id_fkey(full_name, crefito)"
      )
      .eq("id", pacienteId)
      .single(),
    supabase
      .from("evolutions")
      .select("*, profiles!evolutions_fisio_id_fkey(full_name)")
      .eq("patient_id", pacienteId)
      .gte("created_at", monthStart + "T00:00:00")
      .lte("created_at", monthEnd + "T23:59:59")
      .order("created_at"),
    supabase
      .from("appointments")
      .select("status")
      .eq("patient_id", pacienteId)
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
  ]);

  if (!patientRes.data) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const patient = patientRes.data;
  const evolutions = evolutionsRes.data || [];
  const appointments = appointmentsRes.data || [];

  const fisio = patient.profiles as unknown as {
    full_name: string;
    crefito: string;
  };

  // Calcular idade e tempo na carteira
  const age = patient.birth_date
    ? differenceInYears(new Date(), new Date(patient.birth_date))
    : 0;
  const birthDateStr = patient.birth_date
    ? format(new Date(patient.birth_date), "dd/MM/yyyy")
    : "—";

  let timeInPortfolio = "—";
  if (patient.admission_date) {
    const adm = new Date(patient.admission_date);
    const years = differenceInYears(new Date(), adm);
    const months = differenceInMonths(new Date(), adm) % 12;
    timeInPortfolio =
      years > 0 ? `${years} anos e ${months} meses` : `${months} meses`;
  }

  // Calcular médias de sinais vitais
  const bpSysValues: number[] = [];
  const bpDiaValues: number[] = [];
  const hrValues: number[] = [];

  evolutions.forEach((e) => {
    if (e.bp_initial) {
      const parts = e.bp_initial.split("x").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        bpSysValues.push(parts[0]);
        bpDiaValues.push(parts[1]);
      }
    }
    if (e.hr_initial) hrValues.push(e.hr_initial);
  });

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // Contar condutas
  const conductCounts: Record<string, number> = {};
  evolutions.forEach((e) => {
    (e.conducts || []).forEach((c: string) => {
      conductCounts[c] = (conductCounts[c] || 0) + 1;
    });
  });
  const sortedConducts = Object.entries(conductCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Narrativa clínica
  const narrativeParts = evolutions
    .filter((e) => e.observations)
    .map((e, i) => {
      const dateStr = format(new Date(e.created_at), "dd/MM", { locale: ptBR });
      const prefix =
        i === 0
          ? `Na sessão de ${dateStr}, `
          : i < 3
            ? `Em ${dateStr}, `
            : `Posteriormente, em ${dateStr}, `;
      // Pegar primeira frase da observação
      const firstSentence = e.observations!.split(". ").slice(0, 2).join(". ");
      return prefix + firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1);
    });

  const narrative =
    narrativeParts.length > 0
      ? narrativeParts.slice(0, 6).join(". ") + "."
      : "As observações específicas das sessões estão disponíveis nos prontuários internos.";

  // Intercorrências
  const attentionItems = evolutions
    .filter((e) => e.had_intercurrence && e.intercurrence_description)
    .map((e) => ({
      date: format(new Date(e.created_at), "dd/MM"),
      description: e.intercurrence_description!,
    }));

  // Sessões para detalhamento
  const sessions = evolutions.map((e) => ({
    date: format(new Date(e.created_at), "dd/MM"),
    fisioName:
      (e.profiles as unknown as { full_name: string })?.full_name?.split(" ")[0] || "—",
    bpInitial: e.bp_initial || "—",
    bpFinal: e.bp_final || "—",
    hrInitial: e.hr_initial?.toString() || "—",
    hrFinal: e.hr_final?.toString() || "—",
    spo2: e.spo2_initial?.toString() || "—",
    conducts: (e.conducts || []).slice(0, 3).join(", "),
    hadIntercurrence: e.had_intercurrence,
  }));

  const completedCount = appointments.filter(
    (a) => a.status === "completed"
  ).length;
  const totalCount = appointments.length;

  // Montar dados do relatório
  const reportData: ReportData = {
    patient: {
      fullName: patient.full_name,
      birthDate: birthDateStr,
      age,
      diagnosis: patient.primary_diagnosis || "—",
      frequency: patient.weekly_frequency || 0,
      timeInPortfolio,
    },
    fisio: {
      fullName: fisio?.full_name || "—",
      crefito: fisio?.crefito || "—",
    },
    month: monthLabel,
    summary: {
      completed: completedCount,
      total: totalCount,
      avgBpSys: avg(bpSysValues),
      avgBpDia: avg(bpDiaValues),
      avgHr: avg(hrValues),
      intercurrences: attentionItems.length,
    },
    narrative,
    conducts: sortedConducts,
    attentionItems,
    sessions,
  };

  // Gerar PDF
  const pdfBuffer = await renderToBuffer(
    ReportDocument({ data: reportData })
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${patient.full_name.replace(/\s+/g, "-")}-${mes}.pdf"`,
    },
  });
}
