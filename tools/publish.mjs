// Copies the files visitors need into _site/, the folder Cloudflare Pages publishes (its build
// command is `node tools/publish.mjs`, its output directory `_site`). Only the list below goes
// online: content/, tools/, tests/, the docs and the git history stay private with the repository.
// Add a file or folder here if the site starts loading it.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "_site");
const SITE = [
  "index.html", "fr.html", "en.html", "es.html", "sw.js", "robots.txt", "sitemap.xml",
  "assets", "css", "data", "js", "locales", "photos", "fr", "en", "es"
];

fs.rmSync(OUT, {recursive:true, force:true});
for (const f of SITE){
  if (!fs.existsSync(path.join(ROOT, f))) throw new Error(`tools/publish.mjs: ${f} is missing`);
  fs.cpSync(path.join(ROOT, f), path.join(OUT, f), {recursive:true});
}
console.log(`Copied ${SITE.length} files and folders into _site/`);
