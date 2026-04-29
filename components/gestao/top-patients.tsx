import { UserCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type TopPatient = {
  id: string;
  full_name: string;
  fisioName: string;
  weeklyFrequency: number;
  sessionValue: number;
  projectedRevenue: number;
};

type Props = {
  patients: TopPatient[];
};

export function TopPatients({ patients }: Props) {
  if (!patients.length) {
    return (
      <p className="py-8 text-center text-sm text-cinza-texto">
        Sem dados neste período.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-linha-suave">
      {patients.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-creme-fundo text-xs font-semibold text-cinza-texto">
            {i + 1}
          </span>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-linha-suave bg-white">
            <UserCircle className="h-4 w-4 text-cinza-texto" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-tinta-texto">
              {p.full_name}
            </p>
            <p className="text-xs text-cinza-texto">
              {p.fisioName} · {p.weeklyFrequency}x/sem ·{" "}
              {formatCurrency(p.sessionValue)}/sessão
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-tinta-texto">
            {formatCurrency(p.projectedRevenue)}
          </span>
        </li>
      ))}
    </ul>
  );
}
