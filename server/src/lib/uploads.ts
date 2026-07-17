import { mkdirSync } from "node:fs";
import path from "node:path";

export const uploadsDir = path.join(import.meta.dir, "../../uploads");
export const productImagesDir = path.join(uploadsDir, "products");

mkdirSync(productImagesDir, { recursive: true });
