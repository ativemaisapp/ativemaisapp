"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  CheckCircle2,
  Banknote,
  PieChart,
  Download,
  Search,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { KpiCard } from "@/components/gestao/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

type BillingRow = {
  patientId: string;
  patientName: string;
  fisioName: string;
  frequency: number;
  sessions: number;
  valor: number;
  status: "open" | "paid";
  billingId: string | null;
  markedPaidAt: string | null;
};

type PayrollRow = {
  fisioId: string;
  fisioName: string;
  sessions: number;
  repasseValue: number;
  total: number;
  status: "open" | "paid";
  payrollId: string | null;
  markedPaidAt: string | null;
};

type Props = {
  selectedMonth: string;
  months: Array<{ value: string; label: string }>;
  kpis: {
    receitaProjetada: number;
    receitaRealizada: number;
    percentRealizada: number;
    ticketMedio: number;
    repasseTotal: number;
    fisiosComSessoes: number;
    lucro: number;
  };
  billingRows: BillingRow[];
  payrollRows: PayrollRow[];
};

export function FinanceiroContent({
  selectedMonth,
  months,
  kpis,
  billingRows: initBilling,
  payrollRows: initPayroll,
}: Props) {
  const router = useRouter();
  const [billing, setBilling] = useState(initBilling);
  const [payroll, setPayroll] = useState(initPayroll);
  const [billingFilter, setBillingFilter] = useState("");
  const [billingSearch, setBillingSearch] = useState("");

  function handleMonthChange(mes: string) {
    router.push(`/financeiro?mes=${mes}`);
  }

  // Toggle billing status
  async function toggleBilling(row: BillingRow) {
    const supabase = createClient();
    const newStatus = row.status === "open" ? "paid" : "open";
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (row.billingId) {
      await supabase
        .from("billing_status")
        .update({
          status: newStatus,
          marked_paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          marked_by: user?.id || null,
        })
        .eq("id", row.billingId);
    } else {
      const { data } = await supabase
        .from("billing_status")
        .insert({
          patient_id: row.patientId,
          reference_month: selectedMonth,
          status: newStatus,
          marked_paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          marked_by: user?.id || null,
        })
        .select("id")
        .single();
      if (data) row.billingId = data.id;
    }

    setBilling((prev) =>
      prev.map((b) =>
        b.patientId === row.patientId
          ? { ...b, status: newStatus, billingId: row.billingId }
          : b
      )
    );
    toast.success(newStatus === "paid" ? "Marcado como pago" : "Marcado como em aberto");
  }

  // Toggle payroll status
  async function togglePayroll(row: PayrollRow) {
    const supabase = createClient();
    const newStatus = row.status === "open" ? "paid" : "open";
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (row.payrollId) {
      await supabase
        .from("payroll_status")
        .update({
          status: newStatus,
          marked_paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          marked_by: user?.id || null,
        })
        .eq("id", row.payrollId);
    } else {
      const { data } = await supabase
        .from("payroll_status")
        .insert({
          fisio_id: row.fisioId,
          reference_month: selectedMonth,
          status: newStatus,
          marked_paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          marked_by: user?.id || null,
        })
        .select("id")
        .single();
      if (data) row.payrollId = data.id;
    }

    setPayroll((prev) =>
      prev.map((p) =>
        p.fisioId === row.fisioId
          ? { ...p, status: newStatus, payrollId: row.payrollId }
          : p
      )
    );
    toast.success(newStatus === "paid" ? "Repasse marcado como pago" : "Repasse marcado como a pagar");
  }

  // Exportar Excel
  function handleExport() {
    const monthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

    const billingSheet = billing.map((b) => ({
      Paciente: b.patientName,
      Fisioterapeuta: b.fisioName,
      Sessões: b.sessions,
      "Valor (R$)": b.valor,
      Status: b.status === "paid" ? "Pago" : "Em aberto",
    }));

    const payrollSheet = payroll.map((p) => ({
      Profissional: p.fisioName,
      Sessões: p.sessions,
      "Valor/sessão (R$)": p.repasseValue,
      "Total (R$)": p.total,
      Status: p.status === "paid" ? "Pago" : "A pagar",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billingSheet), "Cobrança");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payrollSheet), "Repasses");
    XLSX.writeFile(wb, `financeiro-ative-${selectedMonth}.xlsx`);
    toast.success("Planilha exportada");
  }

  // Filtros
  const filteredBilling = billing.filter((b) => {
    if (billingFilter && b.status !== billingFilter) return false;
    if (billingSearch && !b.patientName.toLowerCase().includes(billingSearch.toLowerCase())) return false;
    return true;
  });

  const totalCobrar = billing.reduce((s, b) => s + b.valor, 0);
  const totalPago = billing.filter((b) => b.status === "paid").reduce((s, b) => s + b.valor, 0);
  const totalAberto = totalCobrar - totalPago;
  const totalRepasses = payroll.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-tinta-texto">Financeiro</h1>
          <p className="text-sm text-cinza-texto">Receita, repasses e cobranças</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="text-cinza-texto cursor-pointer"
          >
            <Download className="mr-1 h-4 w-4" /> Exportar Excel
          </Button>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none cursor-pointer capitalize"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Receita projetada"
          value={formatCurrency(kpis.receitaProjetada)}
          subtitle="se todas as sessões forem realizadas"
          icon={TrendingUp}
          iconColor="text-verde-ative"
        />
        <Card>
          <CardContent className="flex items-start gap-4 pt-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-verde-sucesso/10">
              <CheckCircle2 className="h-5 w-5 text-verde-sucesso" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-cinza-texto uppercase tracking-wide">
                Receita realizada
              </p>
              <p className="mt-1 text-2xl font-semibold text-tinta-texto">
                {formatCurrency(kpis.receitaRealizada)}
              </p>
              <p className="mt-0.5 text-xs text-cinza-texto">
                {kpis.percentRealizada}% da projetada
              </p>
              {kpis.ticketMedio > 0 && (
                <p className={cn("mt-0.5 text-xs", kpis.ticketMedio < 190 ? "text-laranja-ative" : "text-cinza-texto")}>
                  Ticket médio: {formatCurrency(Math.round(kpis.ticketMedio))}
                  {kpis.ticketMedio < 190 && " (abaixo do oficial)"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <KpiCard
          title="Repasses a pagar"
          value={formatCurrency(kpis.repasseTotal)}
          subtitle={`para ${kpis.fisiosComSessoes} profissionais`}
          icon={Banknote}
          iconColor="text-laranja-ative"
        />
        <KpiCard
          title="Lucro líquido estimado"
          value={formatCurrency(kpis.lucro)}
          subtitle="antes de impostos e custos fixos"
          icon={PieChart}
          iconColor={kpis.lucro < 0 ? "text-vermelho-alerta" : "text-tinta-texto"}
        />
      </div>

      {/* Tabela de cobranças */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobrança do mês</CardTitle>
          <CardDescription>Faturamento por paciente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cinza-texto" />
              <Input
                placeholder="Buscar paciente..."
                value={billingSearch}
                onChange={(e) => setBillingSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="open">Em aberto</option>
              <option value="paid">Pago</option>
            </select>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Fisio</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBilling.map((row) => (
                  <TableRow key={row.patientId}>
                    <TableCell>
                      <p className="font-medium text-tinta-texto">{row.patientName}</p>
                      <p className="text-xs text-cinza-texto">{row.frequency}x/sem</p>
                    </TableCell>
                    <TableCell className="text-cinza-texto">{row.fisioName}</TableCell>
                    <TableCell className="text-right">{row.sessions}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.valor)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs border-transparent",
                        row.status === "paid" ? "bg-verde-sucesso/15 text-verde-sucesso" : "bg-ambar-aviso/15 text-ambar-aviso"
                      )}>
                        {row.status === "paid" ? "Pago" : "Em aberto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBilling(row)}
                        className="text-xs cursor-pointer"
                      >
                        {row.status === "paid" ? "Reabrir" : "Marcar pago"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">Totais</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totalCobrar)}</TableCell>
                  <TableCell colSpan={2}>
                    <span className="text-xs text-verde-sucesso">Pago: {formatCurrency(totalPago)}</span>
                    <span className="mx-2 text-xs text-cinza-texto">·</span>
                    <span className="text-xs text-ambar-aviso">Aberto: {formatCurrency(totalAberto)}</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {filteredBilling.map((row) => (
              <div key={row.patientId} className="rounded-lg border border-linha-suave bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-tinta-texto">{row.patientName}</p>
                  <Badge className={cn("text-xs border-transparent",
                    row.status === "paid" ? "bg-verde-sucesso/15 text-verde-sucesso" : "bg-ambar-aviso/15 text-ambar-aviso"
                  )}>
                    {row.status === "paid" ? "Pago" : "Em aberto"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-cinza-texto">
                  <span>{row.sessions} sessões · {row.fisioName}</span>
                  <span className="font-semibold text-tinta-texto">{formatCurrency(row.valor)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleBilling(row)}
                  className="w-full cursor-pointer text-xs"
                >
                  {row.status === "paid" ? "Reabrir" : "Marcar como pago"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de repasses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repasses do mês</CardTitle>
          <CardDescription>Valores devidos à equipe vinculada</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fisioterapeuta</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Valor/sessão</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payroll.map((row) => (
                  <TableRow key={row.fisioId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-linha-suave bg-white">
                          <UserCircle className="h-4 w-4 text-cinza-texto" />
                        </div>
                        <span className="font-medium text-tinta-texto">{row.fisioName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{row.sessions}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.repasseValue)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs border-transparent",
                        row.status === "paid" ? "bg-verde-sucesso/15 text-verde-sucesso" : "bg-ambar-aviso/15 text-ambar-aviso"
                      )}>
                        {row.status === "paid" ? "Pago" : "A pagar"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePayroll(row)}
                        className="text-xs cursor-pointer"
                      >
                        {row.status === "paid" ? "Reabrir" : "Marcar pago"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">Total de repasses</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totalRepasses)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {payroll.map((row) => (
              <div key={row.fisioId} className="rounded-lg border border-linha-suave bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-tinta-texto">{row.fisioName}</p>
                  <Badge className={cn("text-xs border-transparent",
                    row.status === "paid" ? "bg-verde-sucesso/15 text-verde-sucesso" : "bg-ambar-aviso/15 text-ambar-aviso"
                  )}>
                    {row.status === "paid" ? "Pago" : "A pagar"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-cinza-texto">
                  <span>{row.sessions} sessões × {formatCurrency(row.repasseValue)}</span>
                  <span className="font-semibold text-tinta-texto">{formatCurrency(row.total)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePayroll(row)}
                  className="w-full cursor-pointer text-xs"
                >
                  {row.status === "paid" ? "Reabrir" : "Marcar como pago"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
