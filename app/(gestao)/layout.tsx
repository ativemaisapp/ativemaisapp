import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { profileAtendePacientes } from "@/lib/permissions";
import { LogoAtive } from "@/components/logo-ative";
import { SidebarNav } from "@/components/gestao/sidebar-nav";
import { Header } from "@/components/gestao/header";

export default async function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const today = format(spNow, "yyyy-MM-dd");

  const [profileRes, patientsCountRes, billingOpenRes, agendaPendingRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, avatar_url, role")
        .eq("id", user.id)
        .single(),
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

  const profile = profileRes.data;
  if (!profile || profile.role !== "gestao") redirect("/agenda");

  const patientsCount = patientsCountRes.count || 0;
  const billingOpenCount = billingOpenRes.count || 0;
  const agendaPendentes = agendaPendingRes.count || 0;
  const atendePacientes = await profileAtendePacientes(user.id, supabase);

  return (
    <div className="flex h-screen bg-creme-fundo">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-linha-suave lg:bg-white">
        <div className="flex items-center justify-center border-b border-linha-suave p-4">
          <LogoAtive size="sm" />
        </div>
        <SidebarNav
          badges={{ pacientes: patientsCount, financeiro: billingOpenCount }}
          atendePacientes={atendePacientes}
          agendaPendentes={agendaPendentes}
        />
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          profile={{
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            email: profile.email,
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
