"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Appointment = {
  id: string;
  scheduledTime: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  patientId: string;
  patientName: string;
  address: string;
  weeklyFrequency: number;
};

type Props = {
  appointments: Appointment[];
  selectedDate: string;
  isToday: boolean;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
};

export function AgendaContent({
  appointments,
  selectedDate,
  isToday,
  totalCount,
  completedCount,
  pendingCount,
}: Props) {
  const router = useRouter();

  function handleDateChange(date: string) {
    router.push(`/agenda?data=${date}`);
  }

  return (
    <>
      {/* Date picker + resumo */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge className="bg-tinta-texto/10 text-tinta-texto border-transparent text-xs">
            {totalCount} {totalCount === 1 ? "atendimento" : "atendimentos"}
          </Badge>
          <Badge className="bg-verde-sucesso/15 text-verde-sucesso border-transparent text-xs">
            {completedCount} {completedCount === 1 ? "concluído" : "concluídos"}
          </Badge>
          <Badge className="bg-laranja-ative/15 text-laranja-ative border-transparent text-xs">
            {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
          </Badge>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-tinta-texto outline-none cursor-pointer"
        />
      </div>

      {/* Lista de atendimentos */}
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-cinza-texto">
          <Calendar className="h-12 w-12" />
          <p className="text-lg">Sem atendimentos nesta data.</p>
          {isToday && (
            <p className="text-sm">Aproveite para descansar.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <AppointmentCard key={appt.id} appt={appt} />
          ))}
        </div>
      )}
    </>
  );
}

function AppointmentCard({ appt }: { appt: Appointment }) {
  const time = appt.scheduledTime?.slice(0, 5) || "—";

  if (appt.status === "completed") {
    const checkoutTime = appt.checkOutAt
      ? format(new Date(appt.checkOutAt), "HH:mm")
      : "—";
    return (
      <Card className="border-l-[3px] border-l-verde-sucesso/40 opacity-70">
        <CardContent className="flex items-center gap-3 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verde-sucesso/10">
            <Check className="h-5 w-5 text-verde-sucesso" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tinta-texto">{appt.patientName}</p>
            <p className="text-xs text-cinza-texto">
              Concluído às {checkoutTime}
            </p>
          </div>
          <span className="text-sm text-cinza-texto">{time}</span>
        </CardContent>
      </Card>
    );
  }

  if (appt.status === "missed" || appt.status === "cancelled") {
    return (
      <Card className="opacity-50">
        <CardContent className="flex items-center gap-3 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cinza-texto/10">
            <X className="h-5 w-5 text-cinza-texto" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tinta-texto">{appt.patientName}</p>
            <p className="text-xs text-cinza-texto">
              {appt.status === "missed" ? "Faltou" : "Cancelado"}
            </p>
          </div>
          <span className="text-sm text-cinza-texto">{time}</span>
        </CardContent>
      </Card>
    );
  }

  if (appt.status === "in_progress") {
    const checkinTime = appt.checkInAt
      ? format(new Date(appt.checkInAt), "HH:mm")
      : "—";
    return (
      <Card className="border-l-[3px] border-l-verde-sucesso">
        <CardContent className="space-y-3 pt-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-tinta-texto">
                {appt.patientName}
              </p>
              <p className="flex items-center gap-1 text-xs text-verde-sucesso">
                <Clock className="h-3 w-3" />
                Em andamento desde {checkinTime}
              </p>
            </div>
            <span className="text-lg font-semibold text-tinta-texto">
              {time}
            </span>
          </div>
          <Link href={`/atendimento/${appt.id}`}>
            <Button className="h-12 w-full bg-verde-sucesso hover:bg-verde-sucesso/90 text-white text-base cursor-pointer">
              Continuar atendimento
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // status === 'scheduled'
  return (
    <Card className="border-l-[3px] border-l-laranja-ative">
      <CardContent className="space-y-3 pt-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold text-tinta-texto">
              {appt.patientName}
            </p>
            {appt.address && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-cinza-texto">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{appt.address}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold text-tinta-texto">
              {time}
            </span>
            <Badge className="mt-1 block bg-laranja-ative/15 text-laranja-ative border-transparent text-xs">
              {appt.weeklyFrequency}x/sem
            </Badge>
          </div>
        </div>
        <Link href={`/atendimento/${appt.id}`}>
          <Button className="h-12 w-full bg-verde-ative hover:bg-verde-ative/90 text-white text-base cursor-pointer">
            Iniciar atendimento
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
