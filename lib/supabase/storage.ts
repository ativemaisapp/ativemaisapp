import { createClient } from "./client";

const BUCKET = "paciente-arquivos";

export async function uploadPatientFile(
  patientId: string,
  file: File
): Promise<{ path: string }> {
  const supabase = createClient();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${patientId}/${timestamp}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(`Erro ao enviar arquivo: ${error.message}`);
  return { path };
}

export async function getPatientFileUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl)
    throw new Error("Erro ao gerar URL do arquivo");
  return data.signedUrl;
}

export async function deletePatientFile(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Erro ao remover arquivo: ${error.message}`);
}
