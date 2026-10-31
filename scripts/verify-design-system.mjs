// CI guard: design-system manifest is valid JSON, every registered font file
// exists under src/, and no source/CSS references an external font CDN.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const errors = [];
let manifest;
try { manifest = JSON.parse(readFileSync(".lovable/design-system.json", "utf8")); }
catch (e) { errors.push(`design-system.json is not valid JSON: ${e.message}`); }

if (manifest) {
  const assets = Array.isArray(manifest.assets) ? manifest.assets : findAssets(manifest);
  const fonts = assets.filter(a => a && a.kind === "font");
  if (fonts.length === 0) errors.push("no font assets registered in design-system.json");
  for (const f of fonts) {
    if (typeof f.file !== "string" || !f.file.startsWith("src/assets/fonts/")) errors.push(`font outside src/assets/fonts: ${f.file}`);
    else if (!existsSync(f.file)) errors.push(`registered font missing: ${f.file}`);
  }
}

function findAssets(node, out = []) {
  if (Array.isArray(node)) node.forEach(n => findAssets(n, out));
  else if (node && typeof node === "object") {
    if (typeof node.file === "string" && typeof node.kind === "string") out.push(node);
    Object.values(node).forEach(v => findAssets(v, out));
  }
  return out;
}

const CDN = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fast\.fonts\.net|cdn\.fonts\.|use\.fontawesome\.com/i;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(css|tsx?|html|json)$/.test(name) && CDN.test(readFileSync(p, "utf8"))) errors.push(`external font CDN reference: ${p}`);
  }
}
walk("src");
if (existsSync(".lovable/design-system.json") && CDN.test(readFileSync(".lovable/design-system.json", "utf8")))
  errors.push("external font CDN reference in design-system.json");

if (errors.length) { console.error(errors.map(e => "✗ " + e).join("\n")); process.exit(1); }
console.log("✓ design-system manifest, fonts and no-CDN checks passed");
