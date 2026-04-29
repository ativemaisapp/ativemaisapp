"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Limitação intencional do MVP: 1 horário por dia por paciente.
// Caso precise de 2 atendimentos no mesmo dia, criar manualmente no banco.

export type ScheduleEntry = {
  day: number; // 0=Dom, 1=Seg, ..., 6=Sáb
  label: string;
  time: string; // "HH:MM"
};

const WEEKDAYS = [
  { day: 1, label: "Seg" },
  { day: 2, label: "Ter" },
  { day: 3, label: "Qua" },
  { day: 4, label: "Qui" },
  { day: 5, label: "Sex" },
  { day: 6, label: "Sáb" },
  { day: 0, label: "Dom" },
];

type Props = {
  value: ScheduleEntry[];
  onChange: (entries: ScheduleEntry[]) => void;
};

export function SchedulePicker({ value, onChange }: Props) {
  const activeSet = new Set(value.map((v) => v.day));

  function toggle(day: number, label: string) {
    if (activeSet.has(day)) {
      onChange(value.filter((v) => v.day !== day));
    } else {
      const sorted = [...value, { day, label, time: "08:00" }].sort(
        (a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)
      );
      onChange(sorted);
    }
  }

  function updateTime(day: number, time: string) {
    onChange(value.map((v) => (v.day === day ? { ...v, time } : v)));
  }

  return (
    <div className="space-y-3">
      {/* Day toggles */}
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map(({ day, label }) => {
          const isActive = activeSet.has(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day, label)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-verde-ative text-white"
                  : "border border-linha-suave text-cinza-texto hover:border-verde-ative hover:text-verde-ative"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Time inputs for active days */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((entry) => (
            <div
              key={entry.day}
              className="flex items-center gap-2 rounded-md border border-linha-suave px-3 py-2"
            >
              <span className="text-sm font-medium text-tinta-texto w-8">
                {entry.label}
              </span>
              <Input
                type="time"
                value={entry.time}
                onChange={(e) => updateTime(entry.day, e.target.value)}
                className="h-8 w-full text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
