import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  updateSiteContentSchema,
  type SiteContent,
  type SiteContentKey,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SiteContentPage() {
  const { t } = useTranslation();
  const SECTIONS: {
    title: string;
    description: string;
    fields: { key: SiteContentKey; label: string }[];
  }[] = [
    {
      title: t("admin.siteContent.sections.aboutStory.title"),
      description: t("admin.siteContent.sections.aboutStory.description"),
      fields: [
        { key: "about_storyBody1", label: t("admin.siteContent.sections.aboutStory.fields.about_storyBody1") },
        { key: "about_storyBody2", label: t("admin.siteContent.sections.aboutStory.fields.about_storyBody2") },
      ],
    },
    {
      title: t("admin.siteContent.sections.aboutValues.title"),
      description: t("admin.siteContent.sections.aboutValues.description"),
      fields: [
        { key: "about_valueQualityBody", label: t("admin.siteContent.sections.aboutValues.fields.about_valueQualityBody") },
        { key: "about_valueServiceBody", label: t("admin.siteContent.sections.aboutValues.fields.about_valueServiceBody") },
        { key: "about_valueCommunityBody", label: t("admin.siteContent.sections.aboutValues.fields.about_valueCommunityBody") },
      ],
    },
    {
      title: t("admin.siteContent.sections.policyReturns.title"),
      description: t("admin.siteContent.sections.policyReturns.description"),
      fields: [
        { key: "policy_returnsBody1", label: t("admin.siteContent.sections.policyReturns.fields.policy_returnsBody1") },
        { key: "policy_returnsBody2", label: t("admin.siteContent.sections.policyReturns.fields.policy_returnsBody2") },
      ],
    },
    {
      title: t("admin.siteContent.sections.policyPrivacy.title"),
      description: t("admin.siteContent.sections.policyPrivacy.description"),
      fields: [
        { key: "policy_privacyBody1", label: t("admin.siteContent.sections.policyPrivacy.fields.policy_privacyBody1") },
        { key: "policy_privacyBody2", label: t("admin.siteContent.sections.policyPrivacy.fields.policy_privacyBody2") },
      ],
    },
    {
      title: t("admin.siteContent.sections.policyTerms.title"),
      description: t("admin.siteContent.sections.policyTerms.description"),
      fields: [
        { key: "policy_termsBody1", label: t("admin.siteContent.sections.policyTerms.fields.policy_termsBody1") },
        { key: "policy_termsBody2", label: t("admin.siteContent.sections.policyTerms.fields.policy_termsBody2") },
      ],
    },
  ];
  const queryClient = useQueryClient();

  const { data: content, isError } = useQuery({
    queryKey: ["site-content"],
    queryFn: () =>
      axios.get<{ content: SiteContent }>("/api/site-content").then((res) => res.data.content),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SiteContent>({
    resolver: zodResolver(updateSiteContentSchema),
    values: content,
  });

  const mutation = useMutation({
    mutationFn: (input: SiteContent) =>
      axios.put("/api/site-content", input).then((res) => res.data.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "site-content"] });
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.siteContent.saveError")
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.siteContent.title")}</CardTitle>
          <CardDescription>{t("admin.siteContent.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              {t("admin.siteContent.loadError")}
            </p>
          ) : (
            <form
              noValidate
              onSubmit={handleSubmit((input) => mutation.mutate(input))}
              className="space-y-8"
            >
              {SECTIONS.map((section) => (
                <div key={section.title} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
                  <div>
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  {section.fields.map(({ key, label }) => (
                    <div key={key} className="grid gap-1.5">
                      <Label htmlFor={`site-content-${key}`}>{label}</Label>
                      <Textarea
                        id={`site-content-${key}`}
                        rows={3}
                        aria-invalid={!!errors[key]}
                        {...register(key)}
                      />
                      {errors[key] && (
                        <p className="text-sm text-destructive">{errors[key]?.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              {mutation.isSuccess && !mutation.isPending && (
                <p className="text-sm text-muted-foreground">{t("admin.siteContent.saved")}</p>
              )}

              <div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? t("admin.siteContent.saving") : t("admin.siteContent.save")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
