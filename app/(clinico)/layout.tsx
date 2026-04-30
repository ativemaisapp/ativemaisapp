import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { profileAtendePacientes } from "@/lib/permissions";
import { LogoAtive } from "@/components/logo-ative";
import { SidebarNav } from "@/components/gestao/sidebar-nav";
import { Header } from "@/components/gestao/header";
import { FisioUserMenu } from "@/components/gestao/fisio-user-menu";
import { BottomNav } from "@/components/fisio/bottom-nav";

export default async function ClinicoLayout({
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

  // ── Gestao: renderiza sidebar completa ──
  if (profile.role === "gestao") {
    const spNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    const today = format(spNow, "yyyy-MM-dd");

    const [patientsCountRes, billingOpenRes, agendaPendingRes] =
      await Promise.all([
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("billing_status")
          .select("id", { count: "exact", head: true })
          .eq("reference_month", format(spNow, "yyyy-MM"))
          .eq("status", "open"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("fisio_id", user.id)
          .eq("scheduled_date", today)
          .in("status", ["scheduled", "in_progress"]),
      ]);

    return (
      <div className="flex h-screen bg-creme-fundo">
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-linha-suave lg:bg-white">
          <div className="flex items-center justify-center border-b border-linha-suave p-4">
            <LogoAtive size="sm" />
          </div>
          <SidebarNav
            badges={{
              pacientes: patientsCountRes.count || 0,
              financeiro: billingOpenRes.count || 0,
            }}
            atendePacientes={true}
            agendaPendentes={agendaPendingRes.count || 0}
          />
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            profile={{
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              email: profile.email,
            }}
            sidebarProps={{
              badges: {
                pacientes: patientsCountRes.count || 0,
                financeiro: billingOpenRes.count || 0,
              },
              atendePacientes: true,
              agendaPendentes: agendaPendingRes.count || 0,
            }}
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    );
  }

  // ── Fisio: renderiza header simples + bottom nav ──
  return (
    <div className="min-h-screen bg-creme-fundo">
      <header className="flex h-16 items-center justify-between border-b border-linha-suave bg-white px-4">
        <LogoAtive size="sm" />
        <div className="hidden items-center gap-4 lg:flex">
          <a
            href="/agenda"
            className="text-sm text-cinza-texto hover:text-tinta-texto"
          >
            Agenda
          </a>
          <a
            href="/meus-pacientes"
            className="text-sm text-cinza-texto hover:text-tinta-texto"
          >
            Meus pacientes
          </a>
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
