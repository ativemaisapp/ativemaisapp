import type { Database } from "@/lib/database.types";

type Evolution = Database["public"]["Tables"]["evolutions"]["Row"];

/**
 * Verifica se uma evolução tem todos os campos obrigatórios preenchidos.
 * Usado para validar se o protocolo clínico foi cumprido.
 */
export function isEvolutionComplete(evolution: Evolution): boolean {
  return (
    !!evolution.bp_initial &&
    !!evolution.bp_final &&
    evolution.hr_initial !== null &&
    evolution.hr_final !== null &&
    Array.isArray(evolution.conducts) &&
    evolution.conducts.length > 0 &&
    (
      evolution.had_intercurrence === false ||
      (evolution.had_intercurrence === true && !!evolution.intercurrence_description)
    )
  );
}

/**
 * Política de cobrança da família:
 * - completed + missed → cobra (falta sem aviso é cobrável por contrato)
 * - cancelled → não cobra
 */
export function isAppointmentBillable(status: string): boolean {
  return status === "completed" || status === "missed";
}

/**
 * Política de repasse para fisioterapeuta:
 * - completed com evolução completa → conta repasse
 * - missed → conta repasse (fisio cumpriu deslocamento)
 * - cancelled, scheduled, in_progress → não conta
 */
export function isAppointmentPayable(
  appointment: { status: string },
  evolution?: Evolution | null
): boolean {
  if (appointment.status === "completed") {
    return evolution !== undefined && evolution !== null && isEvolutionComplete(evolution);
  }
  if (appointment.status === "missed") {
    return true;
  }
  return false;
}

/** Motivos pré-definidos para falta */
export const MISSED_REASONS = [
  "Paciente não estava em casa",
  "Paciente recusou atendimento",
  "Paciente acamado/indisposto",
  "Paciente não pôde ser atendido",
  "Outro",
] as const;

/** Motivos pré-definidos para cancelamento */
export const CANCELLED_REASONS = [
  "Família comunicou ausência (viagem)",
  "Paciente internado",
  "Paciente faleceu",
  "Família solicitou cancelamento permanente",
  "Conflito de agenda da fisio",
  "Outro",
] as const;

/** Motivos pré-definidos para remarcação */
export const RESCHEDULE_REASONS = [
  "Conflito de agenda do paciente",
  "Conflito de agenda da fisio",
  "Solicitação da família",
  "Recomendação clínica",
  "Outro",
] as const;
