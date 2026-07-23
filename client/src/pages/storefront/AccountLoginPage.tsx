import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { customerSignInSchema, type CustomerSignInInput } from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session, isPending } = customerAuthClient.useSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerSignInInput>({
    resolver: zodResolver(customerSignInSchema),
  });

  if (isPending) {
    return null;
  }
  if (session) {
    return <Navigate to="/account" replace />;
  }

  async function onSubmit({ email, password }: CustomerSignInInput) {
    const { error } = await customerAuthClient.signIn.email({ email, password });
    if (error) {
      setError("root", { message: error.message ?? t("account.login.error") });
      return;
    }
    navigate("/account", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("account.login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">{t("account.email")}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t("account.login.emailPlaceholder")}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.email.message, t)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t("account.password")}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder={t("account.login.passwordPlaceholder")}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.password.message, t)}
                </p>
              )}
            </div>
            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("account.login.submitting") : t("account.login.submit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("account.login.noAccount")}{" "}
            <Link to="/account/signup" className="text-primary hover:underline">
              {t("account.login.signUpLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
