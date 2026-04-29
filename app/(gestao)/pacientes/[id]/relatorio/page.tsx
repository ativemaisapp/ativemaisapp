import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReportGenerator } from "@/components/gestao/report-generator";

type Props = { params: Promise<{ id: string }> };

export default async function RelatorioPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [patientRes, profileRes] = await Promise.all([
    supabase
      .from("patients")
      .select("full_name, family_phone")
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user!.id)
      .single(),
  ]);

  if (!patientRes.data) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/pacientes/${id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-semibold text-tinta-texto">
          Relatório mensal — {patientRes.data.full_name}
        </h1>
        <p className="text-sm text-cinza-texto">
          Selecione o mês e gere o relatório institucional
        </p>
      </div>

      <ReportGenerator
        patientId={id}
        patientName={patientRes.data.full_name}
        familyPhone={patientRes.data.family_phone}
        userName={profileRes.data?.full_name || ""}
      />
    </div>
  );
}
