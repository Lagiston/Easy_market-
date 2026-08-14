import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertTagSchema, type UpsertTagFormInput, type UpsertTagInput } from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TagRow } from "@/components/TagsTable";

// Unlike CategoryForm/ProductForm's en/ar-only tabs, this form exposes all
// four languages — tags were scoped as an all-languages feature (unlike the
// "launch content is English + Arabic only" convention elsewhere), since
// there's no separate content-authoring effort involved, just a short label.
const LANGUAGE_TABS = [
  { key: "en", label: "English", dir: "ltr" },
  { key: "ar", label: "Arabic", dir: "rtl" },
  { key: "sw", label: "Swahili", dir: "ltr" },
  { key: "fr", label: "French", dir: "ltr" },
] as const;

export default function TagForm({ tag, onSuccess }: { tag: TagRow; onSuccess?: (tag: TagRow) => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpsertTagFormInput, unknown, UpsertTagInput>({
    resolver: zodResolver(upsertTagSchema),
    defaultValues: {
      value: tag.value,
      name: {
        en: tag.name.en,
        ar: tag.name.ar ?? "",
        sw: tag.name.sw ?? "",
        fr: tag.name.fr ?? "",
      },
    },
  });

  const mutation = useMutation({
    mutationFn: (input: UpsertTagInput) =>
      axios.put(`/api/tags/${tag.value}`, input).then((res) => res.data.tag as TagRow),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      onSuccess?.(tag);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : "Could not update the tag. Please try again."
    : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      className="grid gap-4"
    >
      <input type="hidden" {...register("value")} />
      <Tabs defaultValue="en">
        <TabsList>
          {LANGUAGE_TABS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>
              {label}
              {key === "en" && errors.name?.en && (
                <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {LANGUAGE_TABS.map(({ key, label, dir }) => (
          <TabsContent key={key} value={key} className="grid gap-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`tag-form-name-${key}`}>{label} name</Label>
              <Input
                id={`tag-form-name-${key}`}
                dir={dir}
                autoComplete="off"
                aria-invalid={key === "en" ? !!errors.name?.en : undefined}
                {...register(`name.${key}`)}
              />
              {key === "en" && errors.name?.en && (
                <p className="text-sm text-destructive">{errors.name.en.message}</p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
