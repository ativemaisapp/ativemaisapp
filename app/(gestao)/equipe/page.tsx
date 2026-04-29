import type { Metadata } from "next";
import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { UserCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Equipe" };

const TECH_LEAD_NAME = "Guilherme Duarte";

export default async function EquipePage() {
  const supabase = await createClient();

  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const monthStart = format(startOfMonth(spNow), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(spNow), "yyyy-MM-dd");

  const [
    { data: profiles },
    { data: patientCounts },
    { data: monthEvolutions },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, crefito, avatar_url, role")
      .order("full_name"),
    supabase
      .from("patients")
      .select("primary_fisio_id")
      .eq("status", "active"),
    supabase
      .from("evolutions")
      .select("fisio_id, appointments!inner(patients!inner(session_value))")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd + "T23:59:59"),
  ]);

  const allProfiles = profiles ?? [];

  // Contagem de pacientes ativos por fisio
  const patientsPerFisio: Record<string, number> = {};
  (patientCounts ?? []).forEach((p) => {
    const fid = p.primary_fisio_id;
    if (fid) patientsPerFisio[fid] = (patientsPerFisio[fid] || 0) + 1;
  });

  // Sessões e receita por fisio no mês
  const sessionsPerFisio: Record<string, number> = {};
  const revenuePerFisio: Record<string, number> = {};
  (monthEvolutions ?? []).forEach((e) => {
    const fid = e.fisio_id;
    if (!fid) return;
    sessionsPerFisio[fid] = (sessionsPerFisio[fid] || 0) + 1;
    const apt = e.appointments as unknown as {
      patients: { session_value: number } | null;
    };
    const sv = apt?.patients?.session_value ?? 0;
    revenuePerFisio[fid] = (revenuePerFisio[fid] || 0) + sv;
  });

  const totalActive = allProfiles.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-tinta-texto">Equipe</h1>
        <p className="text-cinza-texto text-sm mt-1">
          {totalActive} profissionais ativos
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allProfiles.map((profile) => {
          const isTechLead = profile.full_name === TECH_LEAD_NAME;
          const patients = patientsPerFisio[profile.id] || 0;
          const sessions = sessionsPerFisio[profile.id] || 0;
          const revenue = revenuePerFisio[profile.id] || 0;

          const roleBadge = isTechLead ? (
            <Badge className="bg-laranja-ative text-white hover:bg-laranja-ative/90">
              Tech Lead
            </Badge>
          ) : profile.role === "gestao" ? (
            <Badge className="bg-verde-ative text-white hover:bg-verde-ative/90">
              Sócia-administradora
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-cinza-texto">
              Fisioterapeuta
            </Badge>
          );

          const cardContent = (
            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-full bg-creme-fundo flex items-center justify-center overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-cinza-texto" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-tinta-texto truncate">
                      {profile.full_name}
                    </p>
                    {profile.crefito && (
                      <p className="text-sm text-cinza-texto">
                        CREFITO {profile.crefito}
                      </p>
                    )}
                    <div className="mt-1.5">{roleBadge}</div>
                  </div>
                </div>

                <Separator className="my-4" />

                {isTechLead ? (
                  <p className="text-sm text-cinza-texto text-center">
                    Equipe DOM &bull; Suporte técnico
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-semibold text-tinta-texto">
                        {patients}
                      </p>
                      <p className="text-xs text-cinza-texto">Pacientes</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-tinta-texto">
                        {sessions}
                      </p>
                      <p className="text-xs text-cinza-texto">Sessões/mês</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-verde-ative">
                        {formatCurrency(revenue)}
                      </p>
                      <p className="text-xs text-cinza-texto">Receita/mês</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );

          if (isTechLead) {
            return (
              <div key={profile.id} className="cursor-default">
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={profile.id}
              href={`/equipe/${profile.id}`}
              className="block"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
