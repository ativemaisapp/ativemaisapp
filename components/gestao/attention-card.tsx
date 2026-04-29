import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AlertPatient = {
  id: string;
  full_name: string;
  fisioName: string;
  daysSince: number;
};

type Props = {
  patients: AlertPatient[];
};

export function AttentionCard({ patients }: Props) {
  const maxVisible = 5;
  const visible = patients.slice(0, maxVisible);
  const remaining = patients.length - maxVisible;

  return (
    <Card className="border-l-4 border-l-laranja-ative">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-laranja-ative" />
          Pontos de atenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <div className="flex items-center gap-2 text-verde-sucesso">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Tudo em dia.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium text-tinta-texto">
                    {p.full_name}
                  </span>
                  <span className="text-cinza-texto"> · {p.fisioName}</span>
                </div>
                <span className="shrink-0 text-xs font-medium text-vermelho-alerta">
                  {p.daysSince} {p.daysSince === 1 ? "dia" : "dias"} sem
                  atendimento
                </span>
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-xs text-cinza-texto">
                + {remaining} {remaining === 1 ? "outro alerta" : "outros alertas"}.{" "}
                <Link href="/pacientes" className="underline hover:text-tinta-texto">
                  Veja em Pacientes.
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
