"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  patientId: string;
  patientName: string;
  status: "active" | "paused" | "discharged";
};

export function PatientStatusActions({ patientId, patientName, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDischarge() {
    setLoading(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { error: patientError } = await supabase
      .from("patients")
      .update({ status: "discharged" })
      .eq("id", patientId);

    if (patientError) {
      toast.error("Erro ao encerrar atendimento");
      setLoading(false);
      return;
    }

    // Cancelar appointments futuros
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("patient_id", patientId)
      .eq("status", "scheduled")
      .gte("scheduled_date", today);

    toast.success("Atendimento encerrado. Histórico preservado.");
    window.location.href = "/pacientes";
  }

  async function handleReactivate() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("patients")
      .update({ status: "active" })
      .eq("id", patientId);

    if (error) {
      toast.error("Erro ao reativar paciente");
      setLoading(false);
      return;
    }

    toast.success("Paciente reativado. Configure a agenda em Editar.");
    window.location.reload();
  }

  if (status === "active") {
    return (
      <AlertDialog>
        <AlertDialogTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-cinza-texto/30 px-4 text-sm text-cinza-texto hover:bg-cinza-texto/5 cursor-pointer">
          Encerrar atendimento
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Encerrar atendimento de {patientName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O paciente sairá da carteira ativa, mas todo o histórico clínico
              (evoluções, exames, medicamentos) será preservado. Esta ação pode
              ser revertida a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDischarge}
              disabled={loading}
              className="bg-cinza-texto hover:bg-cinza-texto/90 text-white cursor-pointer"
            >
              {loading ? "Encerrando..." : "Encerrar atendimento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (status === "discharged") {
    return (
      <AlertDialog>
        <AlertDialogTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-verde-ative px-4 text-sm text-verde-ative hover:bg-verde-ative/5 cursor-pointer">
          Reativar paciente
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar {patientName}?</AlertDialogTitle>
            <AlertDialogDescription>
              O paciente voltará para a carteira ativa. Você pode configurar a
              nova agenda em Editar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              disabled={loading}
              className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
            >
              {loading ? "Reativando..." : "Reativar paciente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return null;
}
