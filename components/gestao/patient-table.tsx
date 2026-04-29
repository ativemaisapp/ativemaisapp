"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCircle } from "lucide-react";
import {
  differenceInYears,
  differenceInMonths,
  formatDistanceToNow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PatientRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  weekly_frequency: number | null;
  session_value: number | null;
  admission_date: string | null;
  status: "active" | "paused" | "discharged";
  fisioName: string;
  lastSessionDate: string | null;
};

type Props = {
  patients: PatientRow[];
};

function getAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  return `${differenceInYears(new Date(), new Date(birthDate))} anos`;
}

function getTimeInPortfolio(admissionDate: string | null): string {
  if (!admissionDate) return "—";
  const adm = new Date(admissionDate);
  const years = differenceInYears(new Date(), adm);
  const months = differenceInMonths(new Date(), adm) % 12;
  if (years > 0) return `${years}a ${months}m`;
  return `${months}m`;
}

function getLastSession(date: string | null): {
  text: string;
  isWarning: boolean;
} {
  if (!date) return { text: "Nunca atendido", isWarning: false };
  const d = new Date(date);
  const daysAgo =
    (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  const text = formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  return { text, isWarning: daysAgo > 14 };
}

const STATUS_CONFIG = {
  active: { label: "Ativo", className: "bg-verde-sucesso/15 text-verde-sucesso border-transparent" },
  paused: { label: "Pausado", className: "bg-ambar-aviso/15 text-ambar-aviso border-transparent" },
  discharged: { label: "Alta", className: "bg-cinza-texto/15 text-cinza-texto border-transparent" },
};

const FREQ_COLORS: Record<number, string> = {
  5: "bg-verde-ative/15 text-verde-ative border-transparent",
  4: "bg-verde-ative/10 text-verde-ative border-transparent",
  3: "bg-ambar-aviso/15 text-ambar-aviso border-transparent",
  2: "bg-laranja-ative/15 text-laranja-ative border-transparent",
  1: "bg-cinza-texto/15 text-cinza-texto border-transparent",
};

export function PatientTable({ patients }: Props) {
  const router = useRouter();

  if (!patients.length) {
    return (
      <p className="py-12 text-center text-cinza-texto">
        Nenhum paciente corresponde aos filtros.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Fisio</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Na carteira</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última sessão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((p) => {
              const lastSession = getLastSession(p.lastSessionDate);
              const status = STATUS_CONFIG[p.status];
              const freq = p.weekly_frequency || 0;

              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-creme-fundo/50" onClick={() => router.push(`/pacientes/${p.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-linha-suave bg-white">
                        <UserCircle className="h-4 w-4 text-cinza-texto" />
                      </div>
                      <div>
                        <p className="font-medium text-tinta-texto">
                          {p.full_name}
                        </p>
                        <p className="text-xs text-cinza-texto">
                          {getAge(p.birth_date)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-cinza-texto">{p.fisioName}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", FREQ_COLORS[freq] || "")}>
                      {freq}x/sem
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(p.session_value || 0)}
                  </TableCell>
                  <TableCell className="text-cinza-texto">
                    {getTimeInPortfolio(p.admission_date)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", status.className)}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-sm",
                        lastSession.isWarning
                          ? "font-medium text-vermelho-alerta"
                          : p.lastSessionDate
                            ? "text-cinza-texto"
                            : "text-cinza-texto"
                      )}
                    >
                      {lastSession.text}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {patients.map((p) => {
          const lastSession = getLastSession(p.lastSessionDate);
          const status = STATUS_CONFIG[p.status];
          const freq = p.weekly_frequency || 0;

          return (
            <Link
              href={`/pacientes/${p.id}`}
              key={p.id}
              className="block rounded-lg border border-linha-suave bg-white p-4 space-y-2 hover:bg-creme-fundo/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-linha-suave bg-white">
                    <UserCircle className="h-4 w-4 text-cinza-texto" />
                  </div>
                  <div>
                    <p className="font-medium text-tinta-texto">
                      {p.full_name}
                    </p>
                    <p className="text-xs text-cinza-texto">
                      {getAge(p.birth_date)} · {p.fisioName}
                    </p>
                  </div>
                </div>
                <Badge className={cn("text-xs", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-cinza-texto">
                <span>
                  <Badge className={cn("text-xs mr-2", FREQ_COLORS[freq] || "")}>
                    {freq}x/sem
                  </Badge>
                  {formatCurrency(p.session_value || 0)}/sessão
                </span>
                <span>{getTimeInPortfolio(p.admission_date)}</span>
              </div>
              <div className="text-xs">
                <span
                  className={cn(
                    lastSession.isWarning
                      ? "font-medium text-vermelho-alerta"
                      : "text-cinza-texto"
                  )}
                >
                  Última sessão: {lastSession.text}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
