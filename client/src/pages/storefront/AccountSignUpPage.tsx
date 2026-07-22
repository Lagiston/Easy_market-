import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { customerSignUpSchema, type CustomerSignUpInput } from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountSignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session, isPending } = customerAuthClient.useSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerSignUpInput>({
    resolver: zodResolver(customerSignUpSchema),
  });

  if (isPending) {
    return null;
  }
  if (session) {
    return <Navigate to="/account" replace />;
  }

  async function onSubmit({ name, email, password }: CustomerSignUpInput) {
    const { error } = await customerAuthClient.signUp.email({ name, email, password });
    if (error) {
      setError("root", { message: error.message ?? t("account.signUp.error") });
      return;
    }
    navigate("/account", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("account.signUp.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="signup-name">{t("account.name")}</Label>
              <Input
                id="signup-name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">{t("account.email")}</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-password">{t("account.password")}</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
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
              {isSubmitting ? t("account.signUp.submitting") : t("account.signUp.submit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("account.signUp.hasAccount")}{" "}
            <Link to="/account/login" className="text-primary hover:underline">
              {t("account.signUp.signInLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
