"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, UserCircle, LogOut, User } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { LogoAtive } from "@/components/logo-ative";
import { SidebarNav } from "@/components/gestao/sidebar-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pacientes": "Pacientes",
  "/equipe": "Equipe",
  "/financeiro": "Financeiro",
  "/configuracoes": "Configurações",
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + "/")) return title;
  }
  return "Ative+60";
}

type HeaderProps = {
  profile: {
    full_name: string;
    avatar_url: string | null;
    email: string | null;
  };
};

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    router.push("/login");
    router.refresh();
  }

  const firstName = profile.full_name.split(" ")[0];

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-linha-suave bg-white px-4 lg:px-6">
      {/* Esquerda: hamburger (mobile) + título */}
      <div className="flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger aria-label="Abrir menu" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-cinza-texto hover:bg-creme-fundo lg:hidden cursor-pointer">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <div className="flex items-center justify-center border-b border-linha-suave p-4">
              <LogoAtive size="sm" />
            </div>
            <SidebarNav onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <h1 className="text-lg font-semibold text-tinta-texto">
          {getPageTitle(pathname)}
        </h1>
      </div>

      {/* Direita: dropdown do usuário */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-creme-fundo cursor-pointer outline-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-linha-suave bg-white">
            <UserCircle className="h-5 w-5 text-cinza-texto" />
          </div>
          <span className="hidden text-sm text-tinta-texto sm:inline">
            {firstName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-tinta-texto">
              {profile.full_name}
            </p>
            {profile.email && (
              <p className="text-xs text-cinza-texto">{profile.email}</p>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
            <User className="mr-2 h-4 w-4" />
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-vermelho-alerta cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
