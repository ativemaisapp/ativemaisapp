"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Fisio = { id: string; full_name: string };

type Props = {
  fisios: Fisio[];
};

const STATUS_OPTIONS = [
  { value: "", label: "Ativos" },
  { value: "all", label: "Todos" },
  { value: "paused", label: "Em pausa" },
  { value: "discharged", label: "Desligados" },
];

const FREQ_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "1", label: "1x/sem" },
  { value: "2", label: "2x/sem" },
  { value: "3", label: "3x/sem" },
  { value: "4", label: "4x/sem" },
  { value: "5", label: "5x/sem" },
];

export function PatientFilters({ fisios }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchChangeRef = useRef(false);

  // Atualiza URL params sem conflitos entre busca e filtros
  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Debounce apenas para o campo de busca
  useEffect(() => {
    if (!isSearchChangeRef.current) return;
    isSearchChangeRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateParams({ q: searchTerm });
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  function handleSearchChange(value: string) {
    isSearchChangeRef.current = true;
    setSearchTerm(value);
  }

  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-tinta-texto outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 cursor-pointer";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cinza-texto" />
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <select
        className={`${selectClass} w-full sm:w-44`}
        value={searchParams.get("fisio") || ""}
        onChange={(e) => updateParams({ fisio: e.target.value })}
      >
        <option value="">Fisioterapeuta</option>
        {fisios.map((f) => (
          <option key={f.id} value={f.id}>
            {f.full_name}
          </option>
        ))}
      </select>

      <select
        className={`${selectClass} w-full sm:w-36`}
        value={searchParams.get("status") || ""}
        onChange={(e) => updateParams({ status: e.target.value })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className={`${selectClass} w-full sm:w-32`}
        value={searchParams.get("freq") || ""}
        onChange={(e) => updateParams({ freq: e.target.value })}
      >
        {FREQ_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
