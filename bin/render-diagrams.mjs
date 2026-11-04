// render-diagrams.mjs — one-time, dev-only: compiles content/marketing-101/diagrams/*.jsx (the
// same widget code as the Claude Doc) to static SVG files next to them. The page build inlines
// the .svg files, so the site build stays dependency-free.
// Usage: ESBUILD=<path to esbuild package dir> node bin/render-diagrams.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const esbuild = createRequire(import.meta.url)(process.env.ESBUILD);
const DIR = new URL("../content/marketing-101/diagrams/", import.meta.url);
const KEEP = new Set(["viewBox", "refX", "refY", "markerWidth", "markerHeight"]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const flat = (xs) => xs.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false && x !== true);
function h(tag, props, ...kids) {
  props = props || {};
  if (typeof tag === "function") return tag({ ...props, children: kids.length === 1 ? kids[0] : kids });
  const attrs = Object.entries(props).filter(([k]) => k !== "key" && !k.startsWith("data-claude"))
    .map(([k, v]) => ` ${KEEP.has(k) ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${esc(v)}"`).join("");
  return `<${tag}${attrs}>${flat(kids).map((k) => (typeof k === "string" && k.startsWith("<") ? k : esc(k))).join("")}</${tag}>`;
}
const claude = { Visualize: ({ sources, children }) => children({ ...Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.data])), datum: () => ({}) }) };
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".jsx"))) {
  const { code } = esbuild.transformSync(readFileSync(new URL(f, DIR), "utf8"), { loader: "jsx", jsxFactory: "h", format: "cjs" });
  const mod = { exports: {} }; new Function("module", "exports", "h", "claude", code)(mod, mod.exports, h, claude);
  const svg = mod.exports.default();
  writeFileSync(new URL(f.replace(".jsx", ".svg"), DIR), svg + "\n");
  console.log(f, svg.length);
}
