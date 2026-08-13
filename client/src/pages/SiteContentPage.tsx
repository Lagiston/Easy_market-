import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

const SECTIONS: {
  title: string;
  description: string;
  fields: { key: SiteContentKey; label: string }[];
}[] = [
  {
    title: "About page — Our story",
    description: "The two paragraphs under \"Our story\" on the storefront's About page.",
    fields: [
      { key: "about_storyBody1", label: "Story, paragraph 1" },
      { key: "about_storyBody2", label: "Story, paragraph 2" },
    ],
  },
  {
    title: "About page — What we stand for",
    description: "The body text of each of the three value cards.",
    fields: [
      { key: "about_valueQualityBody", label: "\"Real stock, real prices\"" },
      { key: "about_valueServiceBody", label: "\"People, not just a form\"" },
      { key: "about_valueCommunityBody", label: "\"Built for our community\"" },
    ],
  },
  {
    title: "Policy page — Returns & refunds",
    description: "The two paragraphs under the Returns & refunds section.",
    fields: [
      { key: "policy_returnsBody1", label: "Returns, paragraph 1" },
      { key: "policy_returnsBody2", label: "Returns, paragraph 2" },
    ],
  },
  {
    title: "Policy page — Privacy",
    description: "The two paragraphs under the Privacy section.",
    fields: [
      { key: "policy_privacyBody1", label: "Privacy, paragraph 1" },
      { key: "policy_privacyBody2", label: "Privacy, paragraph 2" },
    ],
  },
  {
    title: "Policy page — Terms of service",
    description: "The two paragraphs under the Terms of service section.",
    fields: [
      { key: "policy_termsBody1", label: "Terms, paragraph 1" },
      { key: "policy_termsBody2", label: "Terms, paragraph 2" },
    ],
  },
];

export default function SiteContentPage() {
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
      : "Could not save the content. Please try again."
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site content</CardTitle>
          <CardDescription>
            Edit the body text on the storefront's About and Policy pages. Headings and layout
            stay fixed — only the paragraphs below are editable. English only; other languages
            keep their existing translated text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load site content. Please try again.
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
                <p className="text-sm text-muted-foreground">Content saved.</p>
              )}

              <div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save content"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
