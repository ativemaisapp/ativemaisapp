"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/meus-pacientes", label: "Pacientes", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();

  // Esconder durante atendimento
  if (pathname.startsWith("/atendimento")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-linha-suave bg-white lg:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
              isActive ? "text-verde-ative" : "text-cinza-texto"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
