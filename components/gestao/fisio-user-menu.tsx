"use client";

import { useRouter } from "next/navigation";
import { UserCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  profile: { full_name: string; email: string | null };
};

export function FisioUserMenu({ profile }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-creme-fundo cursor-pointer outline-none">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-linha-suave bg-white">
          <UserCircle className="h-5 w-5 text-cinza-texto" />
        </div>
        <span className="text-sm text-tinta-texto">
          {profile.full_name.split(" ")[0]}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleLogout} className="text-vermelho-alerta cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
