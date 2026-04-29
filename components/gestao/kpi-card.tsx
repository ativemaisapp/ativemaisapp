import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-verde-ative",
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-1">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-verde-ative/10",
            iconColor.includes("laranja") && "bg-laranja-ative/10",
            iconColor.includes("sucesso") && "bg-verde-sucesso/10",
            iconColor.includes("tinta") && "bg-tinta-texto/10",
            iconColor.includes("ambar") && "bg-ambar-aviso/10",
            iconColor.includes("vermelho") && "bg-vermelho-alerta/10"
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-cinza-texto uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold text-tinta-texto truncate">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-cinza-texto">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
