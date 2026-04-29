"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { LogoAtive } from "@/components/logo-ative";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error("Credenciais inválidas. Verifique e-mail e senha.");
      setLoading(false);
      return;
    }

    // Buscar o role do profile para redirecionar
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Erro ao buscar dados do usuário.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "gestao") {
      router.push("/dashboard");
    } else {
      router.push("/agenda");
    }

    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-creme-fundo px-4">
      <Card className="w-full max-w-[400px] shadow-md border-linha-suave">
        <CardHeader className="items-center space-y-4 pb-2">
          <LogoAtive size="md" />
          <div className="text-center">
            <CardTitle className="text-xl font-semibold text-tinta-texto">
              Bem-vindo de volta
            </CardTitle>
            <CardDescription className="text-cinza-texto">
              Acesse sua conta para continuar
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-vermelho-alerta">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-vermelho-alerta">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-verde-ative hover:bg-verde-ative/90 text-white cursor-pointer"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="text-center text-sm text-cinza-texto">
              <span className="cursor-pointer hover:underline">
                Esqueci minha senha
              </span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
