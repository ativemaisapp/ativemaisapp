"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  DollarSign,
  Settings,
  Calendar,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey: "pacientes" | "financeiro" | "agenda" | null;
};

const BASE_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: null },
];

const FISIO_ITEMS: NavItem[] = [
  { href: "/agenda", label: "Minha agenda", icon: Calendar, badgeKey: "agenda" },
  { href: "/meus-pacientes", label: "Meus pacientes", icon: UserCheck, badgeKey: null },
];

const GESTAO_ITEMS: NavItem[] = [
  { href: "/pacientes", label: "Pacientes", icon: Users, badgeKey: "pacientes" },
  { href: "/equipe", label: "Equipe", icon: HeartPulse, badgeKey: null },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, badgeKey: "financeiro" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, badgeKey: null },
];

type Badges = {
  pacientes?: number;
  financeiro?: number;
  agenda?: number;
};

export function SidebarNav({
  onNavigate,
  badges,
  atendePacientes = false,
  agendaPendentes = 0,
}: {
  onNavigate?: () => void;
  badges?: Badges;
  atendePacientes?: boolean;
  agendaPendentes?: number;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    ...BASE_ITEMS,
    ...(atendePacientes ? FISIO_ITEMS : []),
    ...GESTAO_ITEMS,
  ];

  const allBadges: Badges = {
    ...badges,
    agenda: agendaPendentes > 0 ? agendaPendentes : undefined,
  };

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        const badgeValue = item.badgeKey ? allBadges[item.badgeKey] : undefined;

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
                  item.badgeKey === "agenda"
                    ? "bg-laranja-ative/20 text-laranja-ative"
                    : isActive
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
