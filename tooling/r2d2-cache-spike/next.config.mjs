// Explicit configuration for the R2D.2-A synthetic mini application ONLY.
// Next's ancestor configuration belongs to the production Logbook and imports
// production-only relative modules. Never inherit it in this isolated lab.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const labRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Dependencies are installed at the repository root, two directories above
  // this test-only Next project. This is a compiler resolution root, NOT
  // permission to import or build the production application's routes.
  turbopack: { root: resolve(labRoot, "../..") },
};

export default nextConfig;
