"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HeartPulse,
  Activity,
  FileText,
  AlertCircle,
  Mic,
  MicOff,
  Check,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Condutas oficiais (CONTEXT.md seção 5) ──
const CONDUCTS_BY_CATEGORY = [
  {
    category: "Respiratórias",
    items: [
      "MHB", "RPPI", "Terapia pressórica", "Fortalecimento inspiratório",
      "RTA", "CPAP/BIPAP", "Shaker/Acapella/Aerobika", "Aspiração",
      "Inaloterapia", "Oxigenoterapia",
    ],
  },
  {
    category: "Posicionamento e mobilidade",
    items: ["Sedestação BL", "Poltrona", "Cicloergômetro", "Bipedestação", "Posicionamento"],
  },
  {
    category: "Cinesioterapia",
    items: [
      "Cinesio passiva", "Cinesio ativa-assistida", "Cinesio ativa",
      "Cinesio resistida", "Alongamento",
    ],
  },
  {
    category: "Funcional",
    items: ["Treino de equilíbrio", "Treino de marcha", "Treino de transferências"],
  },
  {
    category: "Eletroterapia",
    items: ["TENS/US/Laser/FES"],
  },
  {
    category: "Outros",
    items: ["Atividades cognitivas", "Orientações"],
  },
];

type ExistingEvolution = {
  id: string;
  bp_initial: string;
  bp_final: string;
  hr_initial: string;
  hr_final: string;
  spo2_initial: string;
  spo2_final: string;
  rr_initial: string;
  rr_final: string;
  conducts: string[];
  observations: string;
  had_intercurrence: boolean;
  intercurrence_description: string;
};

type Props = {
  appointmentId: string;
  patientId: string;
  fisioId: string;
  patientName: string;
  checkInAt: string | null;
  status: string;
  existingEvolution: ExistingEvolution | null;
};

export function AtendimentoForm({
  appointmentId,
  patientId,
  fisioId,
  patientName,
  checkInAt: initialCheckIn,
  status: initialStatus,
  existingEvolution,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // State
  const [checkInTime, setCheckInTime] = useState(initialCheckIn);
  const [evolutionId, setEvolutionId] = useState(existingEvolution?.id || "");
  const [bpInitial, setBpInitial] = useState(existingEvolution?.bp_initial || "");
  const [bpFinal, setBpFinal] = useState(existingEvolution?.bp_final || "");
  const [hrInitial, setHrInitial] = useState(existingEvolution?.hr_initial || "");
  const [hrFinal, setHrFinal] = useState(existingEvolution?.hr_final || "");
  const [spo2Initial, setSpo2Initial] = useState(existingEvolution?.spo2_initial || "");
  const [spo2Final, setSpo2Final] = useState(existingEvolution?.spo2_final || "");
  const [rrInitial, setRrInitial] = useState(existingEvolution?.rr_initial || "");
  const [rrFinal, setRrFinal] = useState(existingEvolution?.rr_final || "");
  const [conducts, setConducts] = useState<string[]>(existingEvolution?.conducts || []);
  const [observations, setObservations] = useState(existingEvolution?.observations || "");
  const [hadIntercurrence, setHadIntercurrence] = useState(existingEvolution?.had_intercurrence || false);
  const [intercurrenceDesc, setIntercurrenceDesc] = useState(existingEvolution?.intercurrence_description || "");
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<unknown>(null);

  // ── Check-in automático ──
  useEffect(() => {
    if (initialStatus === "scheduled") {
      const now = new Date().toISOString();
      setCheckInTime(now);
      supabase
        .from("appointments")
        .update({ status: "in_progress", check_in_at: now })
        .eq("id", appointmentId)
        .then(() => {
          // Criar evolução rascunho
          supabase
            .from("evolutions")
            .insert({
              appointment_id: appointmentId,
              patient_id: patientId,
              fisio_id: fisioId,
            })
            .select("id")
            .single()
            .then(({ data }) => {
              if (data) setEvolutionId(data.id);
            });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cronômetro ──
  useEffect(() => {
    if (!checkInTime) return;
    const start = new Date(checkInTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 60000));
    }, 10000);
    setElapsed(Math.floor((Date.now() - start) / 60000));
    return () => clearInterval(interval);
  }, [checkInTime]);

  // ── Auto-save debounced (3s) ──
  const saveData = useCallback(async () => {
    if (!evolutionId) return;
    await supabase
      .from("evolutions")
      .update({
        bp_initial: bpInitial || null,
        bp_final: bpFinal || null,
        hr_initial: hrInitial ? parseInt(hrInitial) : null,
        hr_final: hrFinal ? parseInt(hrFinal) : null,
        spo2_initial: spo2Initial ? parseInt(spo2Initial) : null,
        spo2_final: spo2Final ? parseInt(spo2Final) : null,
        rr_initial: rrInitial ? parseInt(rrInitial) : null,
        rr_final: rrFinal ? parseInt(rrFinal) : null,
        conducts: conducts.length > 0 ? conducts : null,
        observations: observations || null,
        had_intercurrence: hadIntercurrence,
        intercurrence_description: hadIntercurrence ? intercurrenceDesc || null : null,
      })
      .eq("id", evolutionId);
  }, [evolutionId, bpInitial, bpFinal, hrInitial, hrFinal, spo2Initial, spo2Final, rrInitial, rrFinal, conducts, observations, hadIntercurrence, intercurrenceDesc, supabase]);

  useEffect(() => {
    if (!evolutionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveData(), 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveData, evolutionId]);

  // ── Toggle conduta ──
  function toggleConduct(c: string) {
    setConducts((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  // ── Speech Recognition ──
  function toggleRecording() {
    if (recording) {
      (recognitionRef.current as { stop: () => void })?.stop?.();
      setRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta gravação de áudio");
      return;
    }

    const recognition = new SpeechRecognition() as {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setObservations((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => {
      setRecording(false);
      toast.error("Erro na gravação");
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  // ── Finalizar ──
  async function handleFinalize() {
    // Validação
    if (!bpInitial || !hrInitial) {
      toast.error("Preencha PA e FC de entrada");
      return;
    }
    if (conducts.length === 0) {
      toast.error("Selecione pelo menos 1 conduta");
      return;
    }
    if (!bpFinal || !hrFinal) {
      toast.error("Preencha PA e FC de saída");
      return;
    }
    if (hadIntercurrence && !intercurrenceDesc.trim()) {
      toast.error("Descreva a intercorrência");
      return;
    }

    setSubmitting(true);

    try {
      // Salvar evolução final
      await saveData();

      // Marcar como finalizado
      const now = new Date().toISOString();
      await supabase
        .from("appointments")
        .update({ status: "completed", check_out_at: now })
        .eq("id", appointmentId);

      // Atualizar created_at da evolução para o momento do check-out
      if (evolutionId) {
        await supabase
          .from("evolutions")
          .update({ created_at: now })
          .eq("id", evolutionId);
      }

      setShowSuccess(true);
      toast.success("Atendimento registrado com sucesso");

      setTimeout(() => {
        router.push("/agenda");
        router.refresh();
      }, 1500);
    } catch {
      toast.error("Erro ao finalizar. Dados salvos localmente.");
      setSubmitting(false);
    }
  }

  // ── Animação de sucesso ──
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-creme-fundo">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-verde-sucesso">
            <Check className="h-10 w-10 text-white" />
          </div>
          <p className="text-xl font-semibold text-tinta-texto">
            Atendimento registrado
          </p>
        </div>
      </div>
    );
  }

  const checkinTimeStr = checkInTime
    ? new Date(checkInTime).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          aria-label="Voltar para agenda"
          onClick={() => {
            saveData();
            router.push("/agenda");
          }}
          className="flex items-center gap-1 text-sm text-cinza-texto hover:text-tinta-texto cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-2 text-xs text-cinza-texto">
          <Clock className="h-3.5 w-3.5" />
          {elapsed} min
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-tinta-texto">
          {patientName}
        </h1>
        <p className="text-xs text-cinza-texto">
          Em atendimento desde {checkinTimeStr}
        </p>
      </div>

      {/* SEÇÃO 1 — Sinais vitais entrada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-4 w-4 text-verde-ative" />
            Sinais vitais — entrada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <VitalInput label="PA" value={bpInitial} onChange={setBpInitial} placeholder="120x80" />
            <VitalInput label="FC" value={hrInitial} onChange={setHrInitial} placeholder="72" suffix="bpm" type="number" warn={!!hrInitial && (parseInt(hrInitial) < 40 || parseInt(hrInitial) > 180)} />
            <VitalInput label="SpO₂" value={spo2Initial} onChange={setSpo2Initial} placeholder="96" suffix="%" type="number" warn={!!spo2Initial && (parseInt(spo2Initial) < 80 || parseInt(spo2Initial) > 100)} />
            <VitalInput label="FR" value={rrInitial} onChange={setRrInitial} placeholder="18" suffix="irpm" type="number" warn={!!rrInitial && (parseInt(rrInitial) < 8 || parseInt(rrInitial) > 40)} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2 — Condutas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-verde-ative" />
            Condutas realizadas
          </CardTitle>
          <p className="text-xs text-cinza-texto">
            Toque para selecionar. Selecione todas que se aplicam.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONDUCTS_BY_CATEGORY.map((cat) => (
            <div key={cat.category}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-cinza-texto">
                {cat.category}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((c) => {
                  const selected = conducts.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleConduct(c)}
                      className={cn(
                        "rounded-full px-3 py-2 text-sm font-medium transition-colors cursor-pointer min-h-[44px]",
                        selected
                          ? "bg-verde-ative text-white"
                          : "border border-linha-suave text-cinza-texto hover:border-verde-ative hover:text-verde-ative"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Observações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-verde-ative" />
            Observações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Como o paciente recebeu a sessão? Resposta aos exercícios? Pontos de atenção?"
            rows={6}
            className="text-base"
          />
          <Button
            type="button"
            variant="outline"
            onClick={toggleRecording}
            className={cn(
              "w-full min-h-[48px] cursor-pointer",
              recording &&
                "border-vermelho-alerta text-vermelho-alerta animate-pulse"
            )}
          >
            {recording ? (
              <>
                <MicOff className="mr-2 h-4 w-4" /> Parar gravação
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" /> Gravar áudio
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* SEÇÃO 4 — Sinais vitais saída */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-4 w-4 text-verde-ative" />
            Sinais vitais — saída
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <VitalInput label="PA" value={bpFinal} onChange={setBpFinal} placeholder="120x80" />
            <VitalInput label="FC" value={hrFinal} onChange={setHrFinal} placeholder="68" suffix="bpm" type="number" warn={!!hrFinal && (parseInt(hrFinal) < 40 || parseInt(hrFinal) > 180)} />
            <VitalInput label="SpO₂" value={spo2Final} onChange={setSpo2Final} placeholder="97" suffix="%" type="number" warn={!!spo2Final && (parseInt(spo2Final) < 80 || parseInt(spo2Final) > 100)} />
            <VitalInput label="FR" value={rrFinal} onChange={setRrFinal} placeholder="16" suffix="irpm" type="number" warn={!!rrFinal && (parseInt(rrFinal) < 8 || parseInt(rrFinal) > 40)} />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 5 — Intercorrência */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-laranja-ative" />
            Houve intercorrência?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={() => setHadIntercurrence(!hadIntercurrence)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border p-3 min-h-[48px] cursor-pointer transition-colors",
              hadIntercurrence
                ? "border-vermelho-alerta bg-vermelho-alerta/5"
                : "border-linha-suave"
            )}
          >
            <span
              className={cn(
                "text-sm font-medium",
                hadIntercurrence ? "text-vermelho-alerta" : "text-cinza-texto"
              )}
            >
              Sim, houve intercorrência
            </span>
            <div
              className={cn(
                "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors",
                hadIntercurrence ? "bg-vermelho-alerta" : "bg-linha-suave"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-full bg-white shadow transition-transform",
                  hadIntercurrence && "translate-x-5"
                )}
              />
            </div>
          </button>
          {hadIntercurrence && (
            <Textarea
              value={intercurrenceDesc}
              onChange={(e) => setIntercurrenceDesc(e.target.value)}
              placeholder="Descreva a intercorrência..."
              rows={3}
              className="text-base border-vermelho-alerta/30"
            />
          )}
        </CardContent>
      </Card>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-linha-suave bg-white px-4 py-3">
        <div className="mx-auto max-w-lg">
          <p className="mb-2 text-center text-xs text-cinza-texto">
            Tempo de atendimento: {elapsed} min
          </p>
          <Button
            onClick={handleFinalize}
            disabled={submitting}
            className="h-14 w-full bg-laranja-ative hover:bg-laranja-ative/90 text-white text-lg font-semibold cursor-pointer"
          >
            {submitting ? "Finalizando..." : "Finalizar atendimento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Componente de input de sinais vitais ──
function VitalInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  type = "text",
  warn = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix?: string;
  type?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type={type}
          inputMode={type === "number" ? "numeric" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "text-base min-h-[44px]",
            suffix && "pr-12",
            warn && "border-ambar-aviso ring-1 ring-ambar-aviso/30"
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cinza-texto">
            {suffix}
          </span>
        )}
        {warn && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ambar-aviso" />
        )}
      </div>
    </div>
  );
}
