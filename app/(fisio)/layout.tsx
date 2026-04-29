import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoAtive } from "@/components/logo-ative";
import { FisioUserMenu } from "@/components/gestao/fisio-user-menu";
import { BottomNav } from "@/components/fisio/bottom-nav";

export default async function FisioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role === "gestao") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-creme-fundo">
      <header className="flex h-16 items-center justify-between border-b border-linha-suave bg-white px-4">
        <LogoAtive size="sm" />
        {/* Desktop nav links */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/agenda" className="text-sm text-cinza-texto hover:text-tinta-texto">
            Agenda
          </Link>
          <Link href="/meus-pacientes" className="text-sm text-cinza-texto hover:text-tinta-texto">
            Meus pacientes
          </Link>
        </div>
        <FisioUserMenu
          profile={{ full_name: profile.full_name, email: profile.email }}
        />
      </header>
      <main className="p-4 pb-20 lg:pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}
