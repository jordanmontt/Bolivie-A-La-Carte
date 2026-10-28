// Reads today's official exchange rates (US dollar and euro) from the Banco Central de
// Bolivia and writes them to data/rates.js. Run daily by .github/workflows/rates.yml;
// by hand: node tools/update-rates.mjs
// The BCB page can't be read from the visitor's browser (no CORS), hence this copy.
import fs from "node:fs";

const URL = "https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php";
const OUT = "data/rates.js";
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const res = await fetch(URL, {headers: {"User-Agent": "BoliviaALaCarte/1.0 (https://bolivia-alacarte.jordanmontt.fr/)"}});
if (!res.ok) throw new Error(`BCB answered ${res.status}`);
const html = (await res.text()).replace(/&nbsp;/g, " ").replace(/&Oacute;/g, "Ó").replace(/&oacute;/g, "ó");

// "FECHA DE LA COTIZACIÓN: 26 de Octubre 2026"
const d = html.replace(/<[^>]+>/g, " ").match(/FECHA DE LA COTIZACI[ÓO]N:\s*(\d{1,2}) de (\w+) (?:de )?(\d{4})/i);
if (!d) throw new Error("No date in the BCB table");
const month = MONTHS.indexOf(d[2].toLowerCase());
if (month < 0) throw new Error(`Unknown month ${d[2]}`);
const date = `${d[3]}-${String(month + 1).padStart(2, "0")}-${d[1].padStart(2, "0")}`;

// First number after the currency code cell: bolivianos per unit of that currency.
const rate = code => {
  const m = html.match(new RegExp(`<td[^>]*>\\s*${code}\\s*</td>\\s*<td[^>]*>\\s*([\\d.,]+)\\s*</td>`));
  if (!m) throw new Error(`No ${code} rate in the BCB table`);
  const v = Number(m[1].replace(/,/g, ""));
  if (!(v > 1 && v < 100)) throw new Error(`Odd ${code} rate: ${m[1]}`);
  return v;
};
const rates = {date, usd: rate("USD"), eur: rate("EUR"), source: URL};

const text = `// Official exchange rates from the Banco Central de Bolivia (bolivianos per unit).
// Written by tools/update-rates.mjs, do not edit by hand.
window.BOL = window.BOL || {};
BOL.rates = ${JSON.stringify(rates)};
`;
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
if (old === text) console.log(`Rates unchanged (${date}).`);
else { fs.writeFileSync(OUT, text); console.log(`Rates for ${date}: 1 USD = ${rates.usd} Bs, 1 EUR = ${rates.eur} Bs`); }
