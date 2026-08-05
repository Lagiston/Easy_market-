import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  GENDER_VALUES,
  updateCustomerProfileSchema,
  type Gender,
  type UpdateCustomerProfileInput,
} from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { translateFieldError } from "@/lib/zod-error-i18n";
import CustomerAvatarUpload from "@/components/storefront/CustomerAvatarUpload";
import { PhoneInput } from "@/components/PhoneInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// shadcn's Select can't use a literal "" value, so the "not set" choice maps
// to this sentinel in the form and is preprocessed back to undefined by
// updateCustomerProfileSchema — same convention as ProductForm's
// assignedAgentId "unassigned" mapping.
const GENDER_UNSET = "unset";

const GENDER_LABEL_KEYS: Record<Gender, string> = {
  MALE: "account.profile.genderMale",
  FEMALE: "account.profile.genderFemale",
  PREFER_NOT_TO_SAY: "account.profile.genderPreferNotToSay",
};

export default function AccountProfilePage() {
  const { t } = useTranslation();
  const { data: session, refetch } = customerAuthClient.useSession();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCustomerProfileInput>({
    resolver: zodResolver(updateCustomerProfileSchema),
    defaultValues: { name: "", mobile: "", gender: "", region: "" },
  });

  // Prefill once the session resolves — a convenience default the customer
  // can still freely edit, not a hard binding to the account (same
  // "prefill from session" precedent as ProductReviews.tsx's authorName).
  useEffect(() => {
    if (!session) return;
    reset({
      name: session.user.name,
      mobile: session.user.mobile ?? "",
      gender: session.user.gender ?? "",
      region: session.user.region ?? "",
    });
  }, [session, reset]);

  if (!session) {
    return null;
  }

  async function onSubmit({ name, mobile, gender, region }: UpdateCustomerProfileInput) {
    // Better Auth's additionalFields write `undefined` as "leave unchanged"
    // (mirroring Prisma's own `update` semantics) — an explicit `null` is
    // required to actually clear a previously-set value. The client's
    // inferAdditionalFields types these fields as plain `string` even with
    // `required: false`, so `null` needs a cast here; the server's Prisma
    // write (internalAdapter.updateUser passing the body straight through)
    // accepts it correctly at runtime regardless of the client's typing gap.
    const { error } = await customerAuthClient.updateUser({
      name,
      mobile: mobile ?? null,
      gender: gender ?? null,
      region: region ?? null,
    } as Parameters<typeof customerAuthClient.updateUser>[0]);
    if (error) {
      setError("root", { message: error.message ?? t("account.profile.error") });
      return;
    }
    toast.success(t("account.profile.success"));
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{t("account.profile.title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CustomerAvatarUpload image={session.user.image ?? null} onChanged={() => refetch()} />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">{t("account.profile.name")}</Label>
              <Input
                id="profile-name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.name.message, t)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-mobile">{t("account.profile.mobile")}</Label>
              <Controller
                name="mobile"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    id="profile-mobile"
                    autoComplete="tel"
                    aria-invalid={!!errors.mobile}
                    value={(field.value as string | undefined) ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.mobile && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.mobile.message, t)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-gender">{t("account.profile.gender")}</Label>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || GENDER_UNSET}
                    onValueChange={(value) =>
                      field.onChange(value === GENDER_UNSET ? "" : value)
                    }
                  >
                    <SelectTrigger id="profile-gender" className="w-full">
                      <SelectValue placeholder={t("account.profile.genderUnset")}>
                        {(value: string) =>
                          value in GENDER_LABEL_KEYS
                            ? t(GENDER_LABEL_KEYS[value as Gender])
                            : t("account.profile.genderUnset")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENDER_UNSET}>
                        {t("account.profile.genderUnset")}
                      </SelectItem>
                      {GENDER_VALUES.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {t(GENDER_LABEL_KEYS[gender])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-region">{t("account.profile.region")}</Label>
              <Input id="profile-region" aria-invalid={!!errors.region} {...register("region")} />
              {errors.region && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.region.message, t)}
                </p>
              )}
            </div>
            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("account.profile.saving") : t("account.profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
