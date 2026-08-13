import { useRef, useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Single-image variant of the customer avatar upload pattern
// (CustomerAvatarUpload.tsx) — a category's cover image replaces rather than
// appends, so there's no gallery, just one current image (or none) plus
// upload/remove. Unlike the avatar's Better-Auth-session quirk, this is a
// plain TanStack Query cache, so a direct invalidateQueries call on success
// is enough — no external refetch prop needed.
export default function CategoryImageUpload({
  categoryId,
  imageUrl,
  onChanged,
}: {
  categoryId: string;
  imageUrl: string | null;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return axios
        .post<{ imageUrl: string }>(`/api/categories/${categoryId}/image`, formData)
        .then((res) => res.data.imageUrl);
    },
    onSuccess: (url) => {
      setCurrentImageUrl(url);
      onChanged();
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => axios.delete(`/api/categories/${categoryId}/image`),
    onSuccess: () => {
      setCurrentImageUrl(null);
      onChanged();
    },
  });

  const error = uploadMutation.isError
    ? axios.isAxiosError(uploadMutation.error) && uploadMutation.error.response?.data?.error
      ? String(uploadMutation.error.response.data.error)
      : "Could not upload the image. Please try again."
    : removeMutation.isError
      ? "Could not remove the image. Please try again."
      : null;

  return (
    <div className="flex items-center gap-4">
      {currentImageUrl ? (
        <img
          src={currentImageUrl}
          alt=""
          className="size-16 shrink-0 rounded-lg border bg-white object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted"
        >
          <ImageIcon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={currentImageUrl ? "Change category image" : "Upload category image"}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadMutation.mutate(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {currentImageUrl ? "Change image" : "Upload image"}
          </Button>
          {currentImageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              Remove
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
