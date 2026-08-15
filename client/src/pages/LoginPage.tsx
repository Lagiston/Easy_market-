import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginForm = { email: string; password: string };

export default function LoginPage() {
  const { t } = useTranslation();
  const loginSchema = z.object({
    email: z.email(t("admin.login.invalidEmail")),
    password: z.string().min(1, t("admin.login.passwordRequired")),
  });
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  if (isPending) {
    return null;
  }
  if (session) {
    return <Navigate to="/admin" replace />;
  }

  async function onSubmit({ email, password }: LoginForm) {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError("root", { message: error.message ?? t("admin.login.invalidCredentials") });
      return;
    }
    navigate("/admin", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Halatu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("admin.login.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("admin.login.emailPlaceholder")}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("admin.login.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("admin.login.signingIn") : t("admin.login.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
