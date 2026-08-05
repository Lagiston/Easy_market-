import { mkdirSync } from "node:fs";
import path from "node:path";

export const uploadsDir = path.join(import.meta.dir, "../../uploads");
export const productImagesDir = path.join(uploadsDir, "products");
export const customerImagesDir = path.join(uploadsDir, "customers");

mkdirSync(productImagesDir, { recursive: true });
mkdirSync(customerImagesDir, { recursive: true });
