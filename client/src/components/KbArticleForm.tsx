import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  createKbArticleSchema,
  updateKbArticleSchema,
  type UpdateKbArticleFormInput,
  type UpdateKbArticleInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KbArticleRow } from "@/components/KbArticlesTable";

export default function KbArticleForm({
  kbArticle,
  onSuccess,
}: {
  kbArticle?: KbArticleRow;
  onSuccess?: (kbArticle: KbArticleRow) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateKbArticleFormInput, unknown, UpdateKbArticleInput>({
    resolver: zodResolver(kbArticle ? updateKbArticleSchema : createKbArticleSchema),
    defaultValues: kbArticle
      ? {
          title: { en: kbArticle.title.en, ar: kbArticle.title.ar ?? "" },
          body: { en: kbArticle.body.en, ar: kbArticle.body.ar ?? "" },
          topic: kbArticle.topic ?? "",
        }
      : { title: { en: "", ar: "" }, body: { en: "", ar: "" }, topic: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateKbArticleInput) =>
      kbArticle
        ? axios
            .put(`/api/kb-articles/${kbArticle.id}`, input)
            .then((res) => res.data.kbArticle as KbArticleRow)
        : axios
            .post("/api/kb-articles", input)
            .then((res) => res.data.kbArticle as KbArticleRow),
    onSuccess: (kbArticle) => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
      onSuccess?.(kbArticle);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : kbArticle
        ? t("admin.kbArticles.form.updateError")
        : t("admin.kbArticles.form.createError")
    : null;

  const enHasError = !!errors.title?.en || !!errors.body?.en;
  const arHasError = !!errors.title?.ar || !!errors.body?.ar;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      className="grid gap-4"
    >
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">
            {t("admin.products.form.english")}
            {enHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
          <TabsTrigger value="ar">
            {t("admin.products.form.arabic")}
            {arHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="kb-article-form-title-en">{t("admin.kbArticles.form.titleEn")}</Label>
            <Input
              id="kb-article-form-title-en"
              autoComplete="off"
              aria-invalid={!!errors.title?.en}
              {...register("title.en")}
            />
            {errors.title?.en && (
              <p className="text-sm text-destructive">{errors.title.en.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kb-article-form-body-en">{t("admin.kbArticles.form.bodyEn")}</Label>
            <Textarea
              id="kb-article-form-body-en"
              rows={10}
              aria-invalid={!!errors.body?.en}
              {...register("body.en")}
            />
            {errors.body?.en && (
              <p className="text-sm text-destructive">{errors.body.en.message}</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="ar" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="kb-article-form-title-ar">{t("admin.kbArticles.form.titleAr")}</Label>
            <Input
              id="kb-article-form-title-ar"
              dir="rtl"
              autoComplete="off"
              aria-invalid={!!errors.title?.ar}
              {...register("title.ar")}
            />
            {errors.title?.ar && (
              <p className="text-sm text-destructive">{errors.title.ar.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kb-article-form-body-ar">{t("admin.kbArticles.form.bodyAr")}</Label>
            <Textarea
              id="kb-article-form-body-ar"
              dir="rtl"
              rows={10}
              aria-invalid={!!errors.body?.ar}
              {...register("body.ar")}
            />
            {errors.body?.ar && (
              <p className="text-sm text-destructive">{errors.body.ar.message}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="grid gap-1.5">
        <Label htmlFor="kb-article-form-topic">{t("admin.kbArticles.form.topic")}</Label>
        <Input
          id="kb-article-form-topic"
          autoComplete="off"
          aria-invalid={!!errors.topic}
          {...register("topic")}
        />
        {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {kbArticle
            ? mutation.isPending
              ? t("admin.kbArticles.form.saving")
              : t("admin.kbArticles.form.save")
            : mutation.isPending
              ? t("admin.kbArticles.form.creating")
              : t("admin.kbArticles.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
