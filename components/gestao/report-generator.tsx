"use client";

import { useEffect, useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Eye, Send } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  patientId: string;
  patientName: string;
  familyPhone: string | null;
  userName: string;
};

type MonthSummary = {
  completed: number;
  total: number;
  avgBpSys: number;
  avgBpDia: number;
  avgHr: number;
  intercurrences: number;
};

const BUCKET_REPORTS = "relatorios-mensais";

export function ReportGenerator({
  patientId,
  patientName,
  familyPhone,
  userName,
}: Props) {
  const now = new Date();
  const months = Array.from({ length: 13 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Carregar resumo prévio do mês
  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      const supabase = createClient();
      const monthStart = selectedMonth + "-01";
      const monthDate = new Date(selectedMonth + "-15");
      const lastDay = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0
      ).getDate();
      const monthEnd = selectedMonth + `-${lastDay}`;

      const [appointmentsRes, evolutionsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("status")
          .eq("patient_id", patientId)
          .gte("scheduled_date", monthStart)
          .lte("scheduled_date", monthEnd),
        supabase
          .from("evolutions")
          .select(
            "bp_initial, hr_initial, had_intercurrence"
          )
          .eq("patient_id", patientId)
          .gte("created_at", monthStart + "T00:00:00")
          .lte("created_at", monthEnd + "T23:59:59"),
      ]);

      const appts = appointmentsRes.data || [];
      const evos = evolutionsRes.data || [];

      const bpSys: number[] = [];
      const bpDia: number[] = [];
      const hrs: number[] = [];

      evos.forEach((e) => {
        if (e.bp_initial) {
          const parts = e.bp_initial.split("x").map(Number);
          if (parts.length === 2 && !isNaN(parts[0])) {
            bpSys.push(parts[0]);
            bpDia.push(parts[1]);
          }
        }
        if (e.hr_initial) hrs.push(e.hr_initial);
      });

      const avg = (arr: number[]) =>
        arr.length > 0
          ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
          : 0;

      setSummary({
        completed: appts.filter((a) => a.status === "completed").length,
        total: appts.length,
        avgBpSys: avg(bpSys),
        avgBpDia: avg(bpDia),
        avgHr: avg(hrs),
        intercurrences: evos.filter((e) => e.had_intercurrence).length,
      });
      setLoading(false);
    }

    loadSummary();
  }, [selectedMonth, patientId]);

  const pdfUrl = `/api/relatorio/${patientId}?mes=${selectedMonth}`;

  function handleView() {
    window.open(pdfUrl, "_blank");
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `relatorio-${patientName.replace(/\s+/g, "-")}-${selectedMonth}.pdf`;
    a.click();
  }

  async function handleWhatsApp() {
    if (!familyPhone) {
      toast.error("Telefone da família não cadastrado");
      return;
    }

    setGenerating(true);

    try {
      // Gerar o PDF via fetch
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Erro ao gerar PDF");
      const blob = await response.blob();
      const file = new File(
        [blob],
        `relatorio-${selectedMonth}.pdf`,
        { type: "application/pdf" }
      );

      // Upload para bucket relatorios-mensais
      const supabase = createClient();
      const path = `${patientId}/${selectedMonth}.pdf`;

      await supabase.storage.from(BUCKET_REPORTS).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

      // Gerar URL assinada (7 dias)
      const { data: urlData } = await supabase.storage
        .from(BUCKET_REPORTS)
        .createSignedUrl(path, 7 * 24 * 60 * 60);

      const signedUrl = urlData?.signedUrl || "";

      // Salvar registro em monthly_reports
      const { data: existing } = await supabase
        .from("monthly_reports")
        .select("id")
        .eq("patient_id", patientId)
        .eq("reference_month", selectedMonth)
        .single();

      const reportData = {
        patient_id: patientId,
        reference_month: selectedMonth,
        pdf_url: path,
        sent_to_family_at: new Date().toISOString(),
        generated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from("monthly_reports")
          .update(reportData)
          .eq("id", existing.id);
      } else {
        await supabase.from("monthly_reports").insert(reportData);
      }

      // Montar mensagem WhatsApp
      const firstName = patientName.split(" ")[0];
      const monthLabel = months.find(
        (m) => m.value === selectedMonth
      )?.label || selectedMonth;

      const message = [
        `Olá! Segue o relatório clínico do mês de ${monthLabel} de ${firstName}.`,
        `Foram ${summary?.completed || 0} atendimentos realizados pela equipe Ative+60.`,
        `Qualquer dúvida estou à disposição.`,
        ``,
        `Relatório completo: ${signedUrl}`,
        ``,
        `— ${userName.split(" ")[0]}`,
      ].join("\n");

      const phone = familyPhone.replace(/\D/g, "");
      const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

      toast.success("Abrindo WhatsApp...");
      setTimeout(() => {
        window.location.href = waUrl;
      }, 800);
    } catch {
      toast.error("Erro ao preparar envio");
    } finally {
      setGenerating(false);
    }
  }

  const noData = summary && summary.completed === 0;

  return (
    <Card className="mx-auto max-w-[600px]">
      <CardHeader>
        <CardTitle className="text-base">Gerar relatório</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de mês */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
            Mês de referência
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none cursor-pointer capitalize"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Resumo prévio */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-linha-suave" />
            <div className="h-4 w-32 animate-pulse rounded bg-linha-suave" />
          </div>
        ) : summary ? (
          noData ? (
            <div className="rounded-lg border border-ambar-aviso/30 bg-ambar-aviso/5 p-3 text-sm text-ambar-aviso">
              Nenhum atendimento neste mês. Selecione outro mês.
            </div>
          ) : (
            <div className="space-y-1 text-sm text-cinza-texto">
              <p>
                <span className="font-medium text-tinta-texto">
                  {summary.completed}
                </span>{" "}
                atendimentos realizados de {summary.total} previstos
              </p>
              {summary.avgBpSys > 0 && (
                <p>
                  PA média:{" "}
                  <span className="font-medium text-tinta-texto">
                    {summary.avgBpSys}x{summary.avgBpDia}
                  </span>{" "}
                  mmHg
                </p>
              )}
              {summary.avgHr > 0 && (
                <p>
                  FC média:{" "}
                  <span className="font-medium text-tinta-texto">
                    {summary.avgHr}
                  </span>{" "}
                  bpm
                </p>
              )}
              <p>
                <span className="font-medium text-tinta-texto">
                  {summary.intercurrences}
                </span>{" "}
                intercorrências reportadas
              </p>
            </div>
          )
        ) : null}

        {/* Botões */}
        {!noData && summary && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleView}
              className="flex-1 border-verde-ative text-verde-ative hover:bg-verde-ative/5 cursor-pointer"
            >
              <Eye className="mr-2 h-4 w-4" /> Visualizar PDF
            </Button>
            <Button
              onClick={handleDownload}
              className="flex-1 bg-laranja-ative hover:bg-laranja-ative/90 text-white cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
            <Button
              onClick={handleWhatsApp}
              disabled={generating}
              className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white cursor-pointer"
            >
              <Send className="mr-2 h-4 w-4" />
              {generating ? "Enviando..." : "WhatsApp"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
