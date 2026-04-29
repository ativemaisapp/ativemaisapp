"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInYears, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Patient = {
  id: string;
  full_name: string;
  birth_date: string | null;
  weekly_frequency: number | null;
  primary_diagnosis: string | null;
  lastSessionDate: string | null;
};

type Props = {
  patients: Patient[];
  searchQuery: string;
};

export function MeusPacientesContent({ patients, searchQuery }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);

  function handleSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/meus-pacientes?${params.toString()}`);
  }

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cinza-texto" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {patients.length === 0 ? (
        <p className="py-12 text-center text-cinza-texto">
          Nenhum paciente encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => {
            const age = p.birth_date
              ? differenceInYears(new Date(), new Date(p.birth_date))
              : null;
            const lastSession = p.lastSessionDate
              ? formatDistanceToNow(new Date(p.lastSessionDate), {
                  addSuffix: true,
                  locale: ptBR,
                })
              : "Nunca atendido";

            return (
              <Link key={p.id} href={`/meus-pacientes/${p.id}`}>
                <Card className="cursor-pointer hover:bg-creme-fundo/50">
                  <CardContent className="flex items-center gap-3 pt-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-linha-suave bg-white">
                      <UserCircle className="h-5 w-5 text-cinza-texto" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-tinta-texto">
                        {p.full_name}
                      </p>
                      <p className="text-xs text-cinza-texto">
                        {age && `${age} anos · `}
                        {p.weekly_frequency}x por semana
                      </p>
                      <p className="mt-0.5 truncate text-xs text-cinza-texto">
                        {p.primary_diagnosis}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-cinza-texto">{lastSession}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
