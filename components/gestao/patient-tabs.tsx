"use client";

import { useState } from "react";
import {
  format,
  formatDistanceToNow,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  Pill,
  AlertCircle,
  FileText,
  ImageIcon,
  Upload,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  uploadPatientFile,
  getPatientFileUrl,
  deletePatientFile,
} from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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

import type { Patient, Medication, Exam, MonthlyReport } from "@/lib/types";

type EvolutionRow = {
  id: string;
  created_at: string;
  fisioName: string;
  bp_initial: string | null;
  bp_final: string | null;
  hr_initial: number | null;
  hr_final: number | null;
  spo2_initial: number | null;
  spo2_final: number | null;
  conducts: string[] | null;
  observations: string | null;
  had_intercurrence: boolean;
  intercurrence_description: string | null;
};

type Props = {
  patient: Patient;
  medications: Medication[];
  evolutions: EvolutionRow[];
  exams: Exam[];
  reports?: MonthlyReport[];
};

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL COM TABS
// ═══════════════════════════════════════════════════════

export function PatientTabs({
  patient,
  medications: initMeds,
  evolutions,
  exams: initExams,
  reports,
}: Props) {
  return (
    <Tabs defaultValue="dados">
      <TabsList variant="line">
        <TabsTrigger value="dados">Dados</TabsTrigger>
        <TabsTrigger value="medicamentos">Medicamentos</TabsTrigger>
        <TabsTrigger value="evolucoes">Evoluções</TabsTrigger>
        <TabsTrigger value="exames">Exames</TabsTrigger>
        {reports && <TabsTrigger value="relatorios">Relatórios</TabsTrigger>}
      </TabsList>

      <TabsContent value="dados">
        <DataTab patient={patient} />
      </TabsContent>
      <TabsContent value="medicamentos">
        <MedicationsTab patientId={patient.id} initialMeds={initMeds} />
      </TabsContent>
      <TabsContent value="evolucoes">
        <EvolutionsTab evolutions={evolutions} />
      </TabsContent>
      <TabsContent value="exames">
        <ExamsTab patientId={patient.id} initialExams={initExams} />
      </TabsContent>
      {reports && (
        <TabsContent value="relatorios">
          <ReportsTab reports={reports} patientId={patient.id} />
        </TabsContent>
      )}
    </Tabs>
  );
}

// Componente reutilizável para label/valor
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-tinta-texto">{value || "—"}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ABA 1 — DADOS PESSOAIS E CLÍNICOS
// ═══════════════════════════════════════════════════════

function DataTab({ patient }: { patient: Patient }) {
  const p = patient;

  const age = p.birth_date
    ? `${format(new Date(p.birth_date), "dd/MM/yyyy", { locale: ptBR })} (${Math.floor((Date.now() - new Date(p.birth_date).getTime()) / 31557600000)} anos)`
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-2">
      {/* Coluna esquerda */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome completo" value={p.full_name} />
            <Field label="Data de nascimento" value={age} />
            <Field label="CPF" value={p.cpf} />
            <Field label="Telefone" value={p.phone} />
            <Field label="Endereço" value={p.address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contato da família</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Responsável" value={p.family_contact_name} />
            <Field label="Parentesco" value={p.family_relationship} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
                Telefone
              </p>
              {p.family_phone ? (
                <a
                  href={`https://wa.me/55${p.family_phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-sm text-verde-ative hover:underline"
                >
                  {p.family_phone}
                </a>
              ) : (
                <p className="mt-0.5 text-sm text-tinta-texto">—</p>
              )}
            </div>
            <Field label="E-mail" value={p.family_email} />
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Histórico clínico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Diagnóstico principal" value={p.primary_diagnosis} />
          <Field label="Comorbidades" value={p.comorbidities} />
          {p.allergies ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-cinza-texto">
                Alergias
              </p>
              <p className="mt-0.5 text-sm font-medium text-vermelho-alerta">
                {p.allergies}
              </p>
            </div>
          ) : (
            <Field label="Alergias" value="Nenhuma registrada" />
          )}
          <Field label="Observações clínicas" value={p.clinical_notes} />
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ABA 2 — MEDICAMENTOS (CRUD)
// ═══════════════════════════════════════════════════════

function MedicationsTab({
  patientId,
  initialMeds,
}: {
  patientId: string;
  initialMeds: Medication[];
}) {
  const [meds, setMeds] = useState(initialMeds);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleSaveMed(data: {
    name: string;
    dosage: string;
    frequency: string;
    notes: string;
  }) {
    const supabase = createClient();

    if (editingMed) {
      const { error } = await supabase
        .from("medications")
        .update(data)
        .eq("id", editingMed.id);
      if (error) {
        toast.error("Erro ao atualizar medicamento");
        return;
      }
      setMeds((prev) =>
        prev.map((m) => (m.id === editingMed.id ? { ...m, ...data } : m))
      );
      toast.success("Medicamento atualizado");
    } else {
      const { data: newMed, error } = await supabase
        .from("medications")
        .insert({ ...data, patient_id: patientId })
        .select()
        .single();
      if (error || !newMed) {
        toast.error("Erro ao adicionar medicamento");
        return;
      }
      setMeds((prev) => [...prev, newMed]);
      toast.success("Medicamento adicionado");
    }
    setDialogOpen(false);
    setEditingMed(null);
  }

  async function handleDeleteMed(medId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("medications")
      .delete()
      .eq("id", medId);
    if (error) {
      toast.error("Erro ao remover medicamento");
      return;
    }
    setMeds((prev) => prev.filter((m) => m.id !== medId));
    toast.success("Medicamento removido");
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cinza-texto">
          {meds.length} {meds.length === 1 ? "medicamento cadastrado" : "medicamentos cadastrados"}
        </p>
        <Button
          className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
          onClick={() => {
            setEditingMed(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {meds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-cinza-texto">
          <Pill className="h-10 w-10" />
          <p>Nenhum medicamento cadastrado.</p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setEditingMed(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar medicamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {meds.map((med) => (
            <Card key={med.id}>
              <CardContent className="flex items-start justify-between pt-1">
                <div>
                  <p className="font-medium text-tinta-texto">{med.name}</p>
                  <p className="text-sm text-cinza-texto">
                    {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                  </p>
                  {med.notes && (
                    <p className="mt-1 text-xs text-cinza-texto">{med.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    className="rounded p-1 text-cinza-texto hover:bg-creme-fundo hover:text-tinta-texto cursor-pointer"
                    onClick={() => {
                      setEditingMed(med);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger className="rounded p-1 text-cinza-texto hover:bg-vermelho-alerta/10 hover:text-vermelho-alerta cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover medicamento</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover {med.name}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-vermelho-alerta hover:bg-vermelho-alerta/90 text-white cursor-pointer"
                          onClick={() => handleDeleteMed(med.id)}
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de add/edit medicamento */}
      <MedicationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMed(null);
        }}
        initialData={editingMed}
        onSave={handleSaveMed}
      />
    </div>
  );
}

function MedicationDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: Medication | null;
  onSave: (data: {
    name: string;
    dosage: string;
    frequency: string;
    notes: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(initialData?.name || "");
      setDosage(initialData?.dosage || "");
      setFrequency(initialData?.frequency || "");
      setNotes(initialData?.notes || "");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar medicamento" : "Adicionar medicamento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do medicamento *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Losartana"
            />
          </div>
          <div>
            <Label>Dosagem</Label>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="Ex: 50mg"
            />
          </div>
          <div>
            <Label>Frequência</Label>
            <Input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Ex: 1x ao dia"
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm cursor-pointer"
          >
            Cancelar
          </DialogClose>
          <Button
            className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                dosage: dosage.trim(),
                frequency: frequency.trim(),
                notes: notes.trim(),
              })
            }
          >
            {initialData ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// ABA 3 — EVOLUÇÕES
// ═══════════════════════════════════════════════════════

function EvolutionsTab({ evolutions }: { evolutions: EvolutionRow[] }) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);

  const now = new Date();
  const months = [
    { value: "all", label: "Todas" },
    {
      value: format(now, "yyyy-MM"),
      label: format(now, "MMMM yyyy", { locale: ptBR }),
    },
    {
      value: format(subMonths(now, 1), "yyyy-MM"),
      label: format(subMonths(now, 1), "MMMM yyyy", { locale: ptBR }),
    },
    {
      value: format(subMonths(now, 2), "yyyy-MM"),
      label: format(subMonths(now, 2), "MMMM yyyy", { locale: ptBR }),
    },
  ];

  const filtered =
    monthFilter === "all"
      ? evolutions
      : evolutions.filter((e) => e.created_at.startsWith(monthFilter));

  const visible = filtered.slice(0, visibleCount);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (evolutions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-cinza-texto">
        <FileText className="h-10 w-10" />
        <p>Nenhuma evolução registrada para este paciente.</p>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <select
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-tinta-texto outline-none cursor-pointer"
        value={monthFilter}
        onChange={(e) => {
          setMonthFilter(e.target.value);
          setVisibleCount(20);
        }}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-cinza-texto">
          Nenhuma evolução neste período.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((evo) => {
            const d = new Date(evo.created_at);
            const isExpanded = expandedIds.has(evo.id);

            return (
              <Card key={evo.id} className={cn(evo.had_intercurrence && "border-l-4 border-l-vermelho-alerta")}>
                <CardContent className="pt-1 space-y-2">
                  {/* Header da evolução */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-tinta-texto">
                        {format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                      <span className="text-cinza-texto">· {evo.fisioName}</span>
                    </div>
                    {evo.had_intercurrence && (
                      <Badge className="bg-vermelho-alerta/15 text-vermelho-alerta border-transparent text-xs">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Intercorrência
                      </Badge>
                    )}
                  </div>

                  {/* Sinais vitais */}
                  <div className="flex flex-wrap gap-4 text-xs text-cinza-texto">
                    {evo.bp_initial && (
                      <span>PA: {evo.bp_initial} → {evo.bp_final}</span>
                    )}
                    {evo.hr_initial && (
                      <span>FC: {evo.hr_initial} → {evo.hr_final} bpm</span>
                    )}
                    {evo.spo2_initial && (
                      <span>SpO₂: {evo.spo2_initial} → {evo.spo2_final}%</span>
                    )}
                  </div>

                  {/* Condutas */}
                  {evo.conducts && evo.conducts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {evo.conducts.map((c) => (
                        <Badge
                          key={c}
                          className="bg-verde-ative/10 text-verde-ative border-transparent text-xs font-normal"
                        >
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Observação */}
                  {evo.observations && (
                    <div>
                      <p
                        className={cn(
                          "text-sm text-tinta-texto",
                          !isExpanded && "line-clamp-3"
                        )}
                      >
                        {evo.observations}
                      </p>
                      {evo.observations.length > 200 && (
                        <button
                          className="mt-1 text-xs text-verde-ative hover:underline cursor-pointer"
                          onClick={() => toggleExpand(evo.id)}
                        >
                          {isExpanded ? "ver menos" : "ver mais"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Intercorrência expandida */}
                  {evo.had_intercurrence && evo.intercurrence_description && (
                    <div className="rounded-md bg-vermelho-alerta/5 p-2 text-sm text-vermelho-alerta">
                      {evo.intercurrence_description}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {visible.length < filtered.length && (
            <Button
              variant="outline"
              className="w-full cursor-pointer"
              onClick={() => setVisibleCount((c) => c + 20)}
            >
              Carregar mais ({filtered.length - visible.length} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ABA 4 — EXAMES
// ═══════════════════════════════════════════════════════

function ExamsTab({
  patientId,
  initialExams,
}: {
  patientId: string;
  initialExams: Exam[];
}) {
  const [exams, setExams] = useState(initialExams);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examNotes, setExamNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!file || !examName.trim()) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 5MB");
      return;
    }

    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Apenas PDF, PNG ou JPEG");
      return;
    }

    setUploading(true);
    try {
      const { path } = await uploadPatientFile(patientId, file);

      const supabase = createClient();
      const { data: newExam, error } = await supabase
        .from("exams")
        .insert({
          patient_id: patientId,
          name: examName.trim(),
          exam_date: examDate || null,
          file_url: path,
          notes: examNotes.trim() || null,
        })
        .select()
        .single();

      if (error || !newExam) throw new Error("Erro ao salvar exame");

      setExams((prev) => [newExam, ...prev]);
      toast.success("Exame anexado com sucesso");
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(exam: Exam) {
    const supabase = createClient();
    try {
      if (exam.file_url) await deletePatientFile(exam.file_url);
      await supabase.from("exams").delete().eq("id", exam.id);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      toast.success("Exame removido");
    } catch {
      toast.error("Erro ao remover exame");
    }
  }

  async function handleDownload(exam: Exam) {
    if (!exam.file_url) return;
    try {
      const url = await getPatientFileUrl(exam.file_url);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao abrir arquivo");
    }
  }

  function resetForm() {
    setExamName("");
    setExamDate("");
    setExamNotes("");
    setFile(null);
  }

  const isImage = (url: string | null) =>
    url?.match(/\.(png|jpe?g)$/i);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cinza-texto">
          {exams.length} {exams.length === 1 ? "exame anexado" : "exames anexados"}
        </p>
        <Button
          className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Anexar exame
        </Button>
      </div>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-cinza-texto">
          <FileText className="h-10 w-10" />
          <p>Nenhum exame anexado.</p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Upload className="mr-1 h-4 w-4" /> Anexar exame
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {exams.map((exam) => (
            <Card
              key={exam.id}
              className="cursor-pointer hover:bg-creme-fundo/50"
              onClick={() => handleDownload(exam)}
            >
              <CardContent className="flex items-center gap-3 pt-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-laranja-ative/10">
                  {isImage(exam.file_url) ? (
                    <ImageIcon className="h-5 w-5 text-laranja-ative" />
                  ) : (
                    <FileText className="h-5 w-5 text-laranja-ative" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-tinta-texto">
                    {exam.name}
                  </p>
                  <p className="text-xs text-cinza-texto">
                    {exam.exam_date
                      ? format(new Date(exam.exam_date + "T12:00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "Sem data"}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger
                    className="rounded p-1 text-cinza-texto hover:bg-vermelho-alerta/10 hover:text-vermelho-alerta cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover exame</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja remover &quot;{exam.name}&quot;?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-vermelho-alerta hover:bg-vermelho-alerta/90 text-white cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(exam);
                        }}
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de upload */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anexar exame</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do exame *</Label>
              <Input
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Ex: Hemograma completo"
              />
            </div>
            <div>
              <Label>Data do exame</Label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Arquivo (PDF, PNG ou JPEG, máx 5MB) *</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm cursor-pointer">
              Cancelar
            </DialogClose>
            <Button
              className="bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
              disabled={!examName.trim() || !file || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Enviando..." : "Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ABA 5 — RELATÓRIOS
// ═══════════════════════════════════════════════════════

function ReportsTab({
  reports,
  patientId,
}: {
  reports: MonthlyReport[];
  patientId: string;
}) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-cinza-texto">
        <FileText className="h-10 w-10" />
        <p>Nenhum relatório gerado ainda.</p>
        <a href={`/pacientes/${patientId}/relatorio`}>
          <Button variant="outline" className="cursor-pointer">
            Gerar primeiro relatório
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-3">
      {reports.map((r) => {
        const monthLabel = format(
          new Date(r.reference_month + "-15"),
          "MMMM 'de' yyyy",
          { locale: ptBR }
        );
        const generatedLabel = format(
          new Date(r.generated_at),
          "dd/MM/yyyy 'às' HH:mm",
          { locale: ptBR }
        );

        return (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-laranja-ative/10">
                  <FileText className="h-5 w-5 text-laranja-ative" />
                </div>
                <div>
                  <p className="font-medium capitalize text-tinta-texto">
                    {monthLabel}
                  </p>
                  <p className="text-xs text-cinza-texto">
                    Gerado em {generatedLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.sent_to_family_at ? (
                  <Badge className="bg-verde-sucesso/15 text-verde-sucesso border-transparent text-xs">
                    Enviado em{" "}
                    {format(new Date(r.sent_to_family_at), "dd/MM")}
                  </Badge>
                ) : (
                  <Badge className="bg-ambar-aviso/15 text-ambar-aviso border-transparent text-xs">
                    Não enviado
                  </Badge>
                )}
                <a
                  href={`/api/relatorio/${patientId}?mes=${r.reference_month}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-cinza-texto hover:bg-creme-fundo hover:text-tinta-texto cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
