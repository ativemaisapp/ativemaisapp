"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  DollarSign,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: null },
  { href: "/pacientes", label: "Pacientes", icon: Users, badgeKey: "pacientes" as const },
  { href: "/equipe", label: "Equipe", icon: HeartPulse, badgeKey: null },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, badgeKey: "financeiro" as const },
  { href: "/configuracoes", label: "Configurações", icon: Settings, badgeKey: null },
];

type Badges = { pacientes?: number; financeiro?: number };

export function SidebarNav({
  onNavigate,
  badges,
}: {
  onNavigate?: () => void;
  badges?: Badges;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        const badgeValue =
          item.badgeKey && badges ? badges[item.badgeKey] : undefined;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-l-[3px] border-verde-ative bg-verde-ative/8 font-medium text-verde-ative"
                : "text-cinza-texto hover:bg-creme-fundo hover:text-tinta-texto"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {badgeValue !== undefined && badgeValue > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                  isActive
                    ? "bg-verde-ative/20 text-verde-ative"
                    : "bg-linha-suave text-cinza-texto"
                )}
              >
                {badgeValue}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
