import { rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateIcons } from "@profullstack/favicon-generator";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = resolve(repoRoot, "meowter-logo.svg");
const outputDir = resolve(repoRoot, "examples/kitchensink/public/icons");

await rm(outputDir, { recursive: true, force: true });

await generateIcons({
  svgPath,
  outputDir,
  iconSizes: [
    { size: 180, name: "apple-touch-icon.png" },
    { size: 512, name: "icon-512.png" },
  ],
  generateFavicon: false,
  generateRootFavicons: true,
  quality: 95,
  compressionLevel: 9,
  verbose: false,
});

await Promise.all(
  ["manifest.json", "meta-tags.html", "browserconfig.xml", "favicon.png"].map((f) =>
    rm(resolve(outputDir, f), { force: true }),
  ),
);

console.log(`✓ favicons regenerated → ${outputDir}`);
