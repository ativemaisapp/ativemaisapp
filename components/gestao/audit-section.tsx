"use client";

import Link from "next/link";
import { UserCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type AuditData = {
  planned: number;
  completed: number;
  missed: number;
  cancelled: number;
  receitaPlanejada: number;
  receitaRealizada: number;
  prevMonthRate: number | null;
  reasonBreakdown: { reason: string; category: string; count: number }[];
  topAbsent: {
    id: string;
    name: string;
    missed: number;
    cancelled: number;
  }[];
};

export function AuditSection({ data }: { data: AuditData }) {
  const total = data.completed + data.missed + data.cancelled;
  const rate = data.planned > 0
    ? Math.round((data.completed / data.planned) * 1000) / 10
    : 0;
  const prevRate = data.prevMonthRate;

  return (
    <div className="space-y-4">
      {/* Bloco 1 — Comparativo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-tinta-texto">
              {data.planned}
            </p>
            <p className="text-xs text-cinza-texto">Planejados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-verde-sucesso">
              {data.completed}
            </p>
            <p className="text-xs text-cinza-texto">Realizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-tinta-texto">
              {formatCurrency(data.receitaPlanejada)}
            </p>
            <p className="text-xs text-cinza-texto">Receita planejada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-verde-sucesso">
              {formatCurrency(data.receitaRealizada)}
            </p>
            <p className="text-xs text-cinza-texto">Receita realizada</p>
          </CardContent>
        </Card>
      </div>

      {/* Bloco 2 — Taxa de comparecimento */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-tinta-texto">
              {rate}%
            </span>
            <span className="text-sm text-cinza-texto">
              taxa de comparecimento
            </span>
            {prevRate !== null && (
              <span
                className={`text-sm font-medium ${
                  rate >= prevRate ? "text-verde-sucesso" : "text-vermelho-alerta"
                }`}
              >
                {rate >= prevRate ? "+" : ""}
                {Math.round((rate - prevRate) * 10) / 10}% vs mês anterior
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-cinza-texto">
            {data.completed} realizados · {data.missed}{" "}
            {data.missed === 1 ? "falta" : "faltas"} · {data.cancelled}{" "}
            {data.cancelled === 1 ? "cancelamento" : "cancelamentos"}
          </p>
        </CardContent>
      </Card>

      {/* Bloco 3 — Quebra por motivo */}
      {data.reasonBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quebra por motivo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reasonBreakdown.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge
                        className={
                          r.category === "Falta"
                            ? "bg-ambar-aviso/15 text-ambar-aviso border-transparent"
                            : "bg-cinza-texto/10 text-cinza-texto border-transparent"
                        }
                      >
                        {r.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.reason || "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {r.count}
                    </TableCell>
                    <TableCell className="text-right text-cinza-texto">
                      {total > 0
                        ? Math.round((r.count / total) * 100)
                        : 0}
                      %
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bloco 4 — Top pacientes com mais não-comparecimento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pacientes com mais não-comparecimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topAbsent.length === 0 ? (
            <p className="py-4 text-center text-sm text-cinza-texto">
              Tudo certo. Sem não-comparecimentos relevantes este mês.
            </p>
          ) : (
            <div className="space-y-3">
              {data.topAbsent.map((p) => (
                <Link
                  key={p.id}
                  href={`/pacientes/${p.id}`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-creme-fundo transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-creme-fundo">
                    <UserCircle className="h-6 w-6 text-cinza-texto" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-tinta-texto">
                      {p.name}
                    </p>
                    <p className="text-xs text-cinza-texto">
                      {p.missed} {p.missed === 1 ? "falta" : "faltas"} ·{" "}
                      {p.cancelled}{" "}
                      {p.cancelled === 1 ? "cancelamento" : "cancelamentos"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
