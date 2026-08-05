import { useRef } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Single-image variant of ProductImageUpload.tsx's pattern — an avatar
// replaces rather than appends, so there's no gallery, just one current
// image (or none) plus upload/remove.
export default function CustomerAvatarUpload({
  image,
  onChanged,
}: {
  image: string | null;
  // Better Auth's useSession is backed by its own internal store (nanostores),
  // not this app's TanStack QueryClient — it only auto-refreshes on Better
  // Auth's own endpoints (e.g. /update-user). These avatar routes are
  // hand-written Express routes, so the session's cached `image` would go
  // stale after a successful upload/remove without an explicit refetch —
  // the caller passes useSession()'s own `refetch` for that.
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return axios
        .post<{ image: string }>("/api/customer/profile/avatar", formData)
        .then((res) => res.data.image);
    },
    onSuccess: onChanged,
  });

  const removeMutation = useMutation({
    mutationFn: () => axios.delete("/api/customer/profile/avatar"),
    onSuccess: onChanged,
  });

  const error = uploadMutation.isError
    ? axios.isAxiosError(uploadMutation.error) && uploadMutation.error.response?.data?.error
      ? String(uploadMutation.error.response.data.error)
      : t("account.profile.avatarUploadError")
    : removeMutation.isError
      ? t("account.profile.avatarRemoveError")
      : null;

  return (
    <div className="flex items-center gap-4">
      {image ? (
        <img
          src={image}
          alt={t("account.profile.avatarAlt")}
          className="size-16 shrink-0 rounded-full border bg-white object-cover"
        />
      ) : (
        <div
          aria-label={t("account.profile.avatarAlt")}
          className="flex size-16 shrink-0 items-center justify-center rounded-full border bg-muted"
        >
          <UserIcon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={image ? t("account.profile.avatarChange") : t("account.profile.avatarUpload")}
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
            {image ? t("account.profile.avatarChange") : t("account.profile.avatarUpload")}
          </Button>
          {image && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {t("account.profile.avatarRemove")}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
