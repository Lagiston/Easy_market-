import { v2 as cloudinary } from "cloudinary";
import { requiredEnv } from "./env";

// Required at startup, same fail-fast posture as OPENAI_API_KEY (env.ts) —
// Cloudinary is the sole image storage backend (product images, category
// cover images, customer avatars), so a missing/invalid credential should
// surface immediately rather than on first upload attempt.
cloudinary.config({
  cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
  api_key: requiredEnv("CLOUDINARY_API_KEY"),
  api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
  secure: true,
});

// Uploads an already magic-byte-validated image buffer under a
// caller-chosen public_id (server-generated randomUUID(), never derived
// from client input) within `folder` (e.g. "products"). Returns the
// public https delivery URL, stored as-is in the DB (Product.images,
// Category.imageUrl, Customer.image) — same role the local "/api/uploads/..."
// path played before this migration.
export function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
  publicId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "image", overwrite: false },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

// Derives the Cloudinary public_id (folder/<uuid>, no extension) from a
// stored delivery URL's filename portion — mirrors the old
// "<resource>FilenameFromUrl" helpers, just resolving to a public_id
// instead of a local disk path.
export function publicIdFromImageUrl(url: string, folder: string): string {
  const filename = url.slice(url.lastIndexOf("/") + 1);
  const withoutExtension = filename.replace(/\.[^./]+$/, "");
  return `${folder}/${withoutExtension}`;
}

// Best-effort delete, same "unlink().catch(() => {})" posture the local-disk
// version had — a failed cleanup of an old/removed image shouldn't fail the
// request that's replacing or removing it.
export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId).catch(() => {});
}
