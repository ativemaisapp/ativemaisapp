import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "relatorios-mensais";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Buscar report pelo id
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("pdf_url")
    .eq("id", id)
    .single();

  if (!report?.pdf_url) {
    return NextResponse.json({ error: "Relatorio nao encontrado" }, { status: 404 });
  }

  // Gerar signed URL on-the-fly (1h)
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(report.pdf_url, 60 * 60);

  if (!data?.signedUrl) {
    return NextResponse.json({ error: "Erro ao gerar link" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
