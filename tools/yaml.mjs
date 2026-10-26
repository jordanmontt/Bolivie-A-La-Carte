// A small reader and writer for the simple YAML used in content/. No dependencies.
//
// What it understands:
//   key: value                 text, numbers, true/false
//   key:                       followed by an indented block (a map or a list)
//   - item                     list items (text, or "key: value" maps)
//   key: [a, b, [1, 2]]        short lists on one line
//   key: >-                    long text over several lines, joined with spaces
//   key: |-                    text where line breaks are kept
//   "quoted text"              when the text starts with a special sign or holds ": "
//   # comment                  comments, on their own line or after a value
// Keys are simple words (letters, digits, _ . -) or "quoted". Indent with spaces, not tabs.
// Text after "key: " is taken as it is, so "short: Le lieu : super" works.

const KEY = /^([A-Za-z0-9_][A-Za-z0-9_.\-]*|"(?:[^"\\]|\\.)*"):(?:[ ]+(.*))?$/;
const BLOCK = /^[|>][-+]?$/;
const isItem = t => t === "-" || t.startsWith("- ");

export function parse(src, file = "content"){
  const raw = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  const fail = (msg, n = i) => { throw new Error(`${file}, line ${n + 1}: ${msg}`); };
  const skippable = s => /^\s*(#.*)?$/.test(s);
  const indentOf = s => {
    const lead = s.match(/^[ \t]*/)[0];
    if (lead.includes("\t")) fail("use spaces, not tabs, to indent");
    return lead.length;
  };
  const skip = () => { while (i < raw.length && skippable(raw[i])) i++; };

  function node(indent){
    skip();
    if (i >= raw.length) return null;
    return isItem(raw[i].slice(indent)) ? list(indent) : map(indent);
  }
  function map(indent){
    const out = {};
    for (;;){
      skip();
      if (i >= raw.length) break;
      const n = indentOf(raw[i]);
      if (n < indent) break;
      if (n > indent) fail("this line is indented too far");
      const text = raw[i].slice(indent);
      if (isItem(text)) break;
      const m = text.match(KEY);
      if (!m) fail(`expected "key: value", found "${text.trim()}"`);
      const key = m[1].startsWith('"') ? JSON.parse(m[1]) : m[1];
      if (Object.prototype.hasOwnProperty.call(out, key)) fail(`"${key}" appears twice`);
      const at = i++;
      out[key] = value(m[2] || "", indent, at);
    }
    return out;
  }
  function list(indent){
    const out = [];
    for (;;){
      skip();
      if (i >= raw.length) break;
      const n = indentOf(raw[i]);
      if (n < indent) break;
      if (n > indent) fail("this line is indented too far");
      const text = raw[i].slice(indent);
      if (!isItem(text)) break;
      const rest = uncomment(text.slice(1)), at = i;
      if (rest === ""){ i++; out.push(value("", indent, at)); }
      else if (KEY.test(rest)){
        // "- key: value": a map whose keys line up after the dash.
        const after = text.slice(1).trimStart();
        const col = indent + text.length - after.length;
        raw[i] = " ".repeat(col) + after;
        out.push(map(col));
      }
      else { i++; out.push(BLOCK.test(rest) ? block(rest[0], indent) : scalar(rest, at)); }
    }
    return out;
  }
  // "value   # comment": drop the comment (inside "quotes", # is kept).
  function uncomment(s){
    s = s.trim();
    if (s.startsWith('"') || s.startsWith("'")){
      const q = s[0], m = q === '"' ? s.match(/^"(?:[^"\\]|\\.)*"/) : s.match(/^'(?:[^']|'')*'/);
      if (m && /^\s*(#.*)?$/.test(s.slice(m[0].length))) return m[0];
      return s;
    }
    const k = s.search(/\s#/);
    return k < 0 ? s : s.slice(0, k).trim();
  }
  function value(rest, indent, at){
    rest = uncomment(rest);
    if (rest === ""){
      skip();
      if (i >= raw.length) return null;
      const n = indentOf(raw[i]);
      if (n > indent) return node(n);
      if (n === indent && isItem(raw[i].slice(n))) return list(n);
      return null;
    }
    if (BLOCK.test(rest)) return block(rest[0], indent);
    return scalar(rest, at);
  }
  // Text spread over the following, more indented lines.
  function block(style, indent){
    const lines = [];
    let inner = -1;
    while (i < raw.length){
      const s = raw[i];
      if (s.trim() === ""){ lines.push(""); i++; continue; }
      const n = indentOf(s);
      if (n <= indent) break;
      if (inner < 0) inner = n;
      lines.push(s.slice(Math.min(n, inner)));
      i++;
    }
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (style === "|") return lines.join("\n");
    let out = "";
    lines.forEach((l, k) => {
      if (l === "") out += "\n";
      else out += (k && lines[k - 1] !== "" ? " " : "") + l;
    });
    return out;
  }
  function scalar(s, at){
    if (s.startsWith('"')){
      try { return JSON.parse(s); } catch(e){ fail("unclosed or broken \"quoted text\"", at); }
    }
    if (s.startsWith("'")){
      if (!s.endsWith("'") || s.length < 2) fail("unclosed 'quoted text'", at);
      return s.slice(1, -1).replace(/''/g, "'");
    }
    if (s.startsWith("[")) return flow(s, at);
    if (s.startsWith("{")) fail("write this as indented lines (key: value) instead of {…}", at);
    return plain(s);
  }
  function flow(s, at){
    let k = 0;
    const item = () => {
      while (s[k] === " ") k++;
      if (s[k] === "["){
        k++;
        const arr = [];
        for (;;){
          while (s[k] === " ") k++;
          if (s[k] === "]"){ k++; return arr; }
          arr.push(item());
          while (s[k] === " ") k++;
          if (s[k] === ","){ k++; continue; }
          if (s[k] === "]"){ k++; return arr; }
          fail("broken [list]", at);
        }
      }
      if (s[k] === '"'){
        const m = s.slice(k).match(/^"(?:[^"\\]|\\.)*"/);
        if (!m) fail("unclosed \"quoted text\" in [list]", at);
        k += m[0].length;
        return JSON.parse(m[0]);
      }
      const start = k;
      while (k < s.length && s[k] !== "," && s[k] !== "]") k++;
      return plain(s.slice(start, k).trim());
    };
    const v = item();
    if (s.slice(k).trim()) fail("unexpected text after [list]", at);
    return v;
  }
  const v = node(0);
  skip();
  if (i < raw.length) fail("could not read this line");
  return v;
}

function plain(s){
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

// ───── Writer: the same style, easy to read and edit by hand ─────
const WIDTH = 92;
const plainSafe = s => s !== "" && s.trim() === s && !/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)
  && !/: |:$| #/.test(s) && !/[\n\t]/.test(s) && typeof plain(s) === "string";
const keyText = k => /^[A-Za-z0-9_][A-Za-z0-9_.\-]*$/.test(k) ? k : JSON.stringify(k);
const isScalar = v => v === null || typeof v !== "object";

function scalarText(v){
  if (v === null) return "null";
  if (typeof v !== "string") return String(v);
  return plainSafe(v) ? v : JSON.stringify(v);
}
function flowText(v){
  if (Array.isArray(v)) return "[" + v.map(flowText).join(", ") + "]";
  return typeof v === "string" && /[,[\]]/.test(v) ? JSON.stringify(v) : scalarText(v);
}
// One-line lists only for numbers and ids (coordinates, days, dish ids); text items get one line each.
const word = x => typeof x !== "string" || /^[\w.\-]+$/.test(x);
const shortList = v => Array.isArray(v) && v.every(x => isScalar(x) ? word(x) : Array.isArray(x) && x.every(y => isScalar(y) && word(y)))
  && flowText(v).length <= 120;

// Text for a value that follows "key:" or "- " at the given indent.
function inline(v, indent){
  if (typeof v === "string"){
    if (v.includes("\n") && v.trim() === v) return "|-\n" + v.split("\n").map(l => l ? " ".repeat(indent + 2) + l : "").join("\n");
    if (v.length + indent > WIDTH && v.trim() === v && !/\s\s|\n/.test(v)){
      const lines = []; let line = "";
      for (const w of v.split(" ")){
        if (line && (line + " " + w).length + indent + 2 > WIDTH){ lines.push(line); line = w; }
        else line = line ? line + " " + w : w;
      }
      lines.push(line);
      return ">-\n" + lines.map(l => " ".repeat(indent + 2) + l).join("\n");
    }
  }
  return null;
}
export function dump(v, indent = 0){
  const pad = " ".repeat(indent);
  if (Array.isArray(v)){
    return v.map(x => {
      if (isScalar(x)) return pad + "- " + (inline(x, indent) || scalarText(x));
      if (Array.isArray(x)) return pad + "- " + flowText(x);
      const body = dump(x, indent + 2);
      return pad + "- " + body.slice(indent + 2);
    }).join("\n");
  }
  return Object.entries(v).map(([k, x]) => {
    const head = pad + keyText(k) + ":";
    if (isScalar(x)) return head + " " + (inline(x, indent) || scalarText(x));
    if (Array.isArray(x)){
      if (!x.length) return head + " []";
      if (shortList(x)) return head + " " + flowText(x);
      return head + "\n" + dump(x, indent + 2);
    }
    if (!Object.keys(x).length) return head + " {}";
    return head + "\n" + dump(x, indent + 2);
  }).join("\n");
}
