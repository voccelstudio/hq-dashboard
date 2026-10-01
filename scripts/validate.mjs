#!/usr/bin/env node
// Validador previo al deploy. Corre en CI y localmente: node scripts/validate.mjs
// Sin dependencias: solo node:fs / node:vm / node:path.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------------------------------------------------------------- 1. sintaxis JS
function checkSyntax(file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    return true;
  } catch (e) {
    const out = (e.stderr?.toString() || e.message).trim().split('\n').slice(0, 4).join('\n');
    return out;
  }
}

const jsFiles = ['assets/index-Cpp8q40q.js', 'assets/features.js', 'assets/command-palette.js', 'sw.js']
  .filter((f) => existsSync(join(ROOT, f)));

for (const f of jsFiles) {
  const res = checkSyntax(join(ROOT, f));
  if (res !== true) fail(`SYNTAX ERROR en ${f}:\n${res}`);
}

// ------------------------------------------- 2. los assets referenciados existen
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
  const url = m[1];
  if (/^(https?:|data:|#|mailto:|javascript:|\/\/)/.test(url)) continue;
  refs.add(url.replace(/^\.\//, '').split(/[?#]/)[0]);
}
for (const r of refs) {
  if (!r) continue;
  if (!existsSync(join(ROOT, r))) fail(`ASSET ROTO: index.html referencia "./${r}" y no existe en el repo`);
}

// el bundle principal no puede estar duplicado con otro .js igual
const bundleRefs = [...html.matchAll(/<script[^>]*src="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const onDisk = readdirSync(join(ROOT, 'assets')).filter((f) => f.endsWith('.js'));
for (const f of onDisk) {
  if (!bundleRefs.includes(f)) warn(`ORFELINO: assets/${f} existe pero index.html no lo carga`);
}

// ------------------------------------------- 3. el service worker cachea de verdad
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

// El nombre del cache tiene que derivar del build, no de un número que alguien
// se acuerda de subir. Esto es lo que arregla el "el SW me sirve JS viejo".
const declaresBuild = /const BUILD\s*=/.test(sw);
if (!declaresBuild) {
  fail('SW: no declara BUILD. Sin un build id el cache nunca se invalida solo.');
} else {
// El build id puede llegar al nombre del cache directo o por una variable
  // intermedia (VERSION). Lo que no vale es un número escrito a mano.
  const cacheDecl = sw.match(/const CACHE\s*=\s*([^;]+);/);
  const manualVersion = cacheDecl && /['"`]sys-dashboard-v\d+['"`]/.test(cacheDecl[1]);
  const buildReachesCache =
    cacheDecl &&
    (/\bBUILD\b/.test(cacheDecl[1]) ||
      [...sw.matchAll(/const (\w+)\s*=\s*([^;]*BUILD[^;]*);/g)].some(([, name, rhs]) =>
        new RegExp(`\\b${name}\\b`).test(cacheDecl[1]) && /\bBUILD\b/.test(rhs)
      ));
  if (manualVersion || !buildReachesCache) {
    fail('SW: el nombre del cache no deriva de BUILD — bump manual = cache obsoleto para siempre');
  }

  // Trampa del sed de deploy: si el placeholder aparece en el chequeo del
  // fallback ("BUILD === '__BUILD_SHA__' ? 'dev' : ..."), el sed lo reemplaza
  // también y la comparación queda siempre en true -> VERSION cae a 'dev' en
  // cada release y el cache nunca se invalida. El sentinel tiene que ser algo
  // que el sed no pueda reproducir.
  const unversionedGuard = sw.match(/BUILD\s*===\s*['"]([^'"]+)['"]/);
  if (unversionedGuard) {
    fail(
      `SW: el guard de "sin versionar" compara contra el placeholder literal ` +
        `(${unversionedGuard[1]}). El sed de deploy lo sobreescribe y el cache queda ` +
        `siempre en 'dev'.\n  -> usá una forma que no dependa del texto, p.ej. ` +
        `/^__[A-Z_]+__$/.test(BUILD).`
    );
  }
  if (/BUILD\s*\.startsWith\(\s*['"]__/.test(sw)) {
    warn('SW: el guard usa startsWith("__") — si el build id empieza con "__" el cache no se versiona (no va a pasar, pero es frágil)');
  }
}

if (!/addEventListener\(\s*['"]install['"]/.test(sw)) fail('SW: falta el handler "install"');
if (!/caches\.open\(/.test(sw)) fail('SW: nunca precachea nada — offline no funciona en la primera visita');
if (!/skipWaiting/.test(sw)) warn('SW: sin skipWaiting, los updates quedan esperando a que cierre todas las pestanas');

// Todo lo que el SW precachea tiene que existir, si no el shell entra a medias.
const precacheBlock = sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\]/);
if (!precacheBlock) {
  fail('SW: falta la lista PRECACHE');
} else {
  const urls = [...precacheBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const u of urls) {
    if (!u.startsWith('.')) continue;
    const p = u.replace(/^\.\//, '');
    if (p && !existsSync(join(ROOT, p))) fail(`SW PRECACHE ROTO: "${u}" no existe en el repo`);
  }
}

// Un 404 cacheado envenena el cache para siempre y se manifesta como "el sitio
// no me carga" semanas después.
if (!/\.ok\b/.test(sw)) {
  warn('SW: no filtra por response.ok antes de cachear — un 404 queda cacheado para siempre');
}

// crossorigin en un <link> local del mismo origen es ruido: la respuesta sigue
// siendo type "basic" y el precache funciona igual, pero en otro host con CORS
// estricto rompe. Ojo: <link rel="preconnect"> a un CDN sí lo necesita, ahí sí
// es cross-origin real — por eso el filtro mira que el href sea local.
for (const m of html.matchAll(/<link[^>]+crossorigin[^>]*href="\.\/[^"]*"[^>]*>/g)) {
  warn(`HTML: ${m[0].trim()}\n  ->innecesario en mismo origen. Funciona en Pages, pero ya causó fallos antes.`);
}

// ------------------------------------------- 4. regresiones de HTML conocidas
if (/<script type="module"[^>]*src=/.test(html)) {
  fail('HTML: <script type="module" src> esta roto en Safari/iOS — usá type="module" inline o defer');
}
const moduleInline = /<script type="module">/.test(html);
if (moduleInline && !/import\s+.*from\s+['"]three/.test(html)) {
  warn('HTML: hay un <script type="module"> pero no importa three — el importmap podría estar sin uso');
}

// El CHRONOS importa three por el importmap (0.160, ESM), pero Vanta necesita
// el THREE global de r121. Son dos Copies distintas de la misma librería en
// cada carga: ~600KB extra que en móvil es la diferencia entre pintar y no.
const threeModule = /import\s+\*\s+as THREE\s+from\s+['"]three['"]/.test(html);
const threeGlobal = /three(\.min)?\.js['"]/.test(html) && /cdnjs[^"']*three/.test(html);
if (threeModule && threeGlobal) {
  warn(
    `HTML: se cargan DOS copias de three.js — el importmap (ESM 0.160) y el global r121 para Vanta.\n` +
      `  -> unas 600KB duplicadas por carga. Si Vanta no usa nada de r121 que falte en 0.160,\n` +
      `     se puede exponer el THREE del module en window y borrar el <script> de cdnjs.`
  );
}
// el manifest debe existir y ser JSON valido
try {
  JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
} catch (e) {
  fail(`MANIFEST: JSON invalido — ${e.message}`);
}

// ------------------------------------------- 5. orden de capas de CSS
const cssOrder = [...html.matchAll(/<link[^>]+href="\.\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);
const idxBase = cssOrder.indexOf('style-CxH7Ekp1.css');
const idxFeatures = cssOrder.indexOf('features.css');
const idxXp = cssOrder.indexOf('xp-theme.css');
if (idxBase === -1) fail('CSS: falta el bundle base style-CxH7Ekp1.css');
if (idxXp > -1 && idxBase > idxXp) fail('CSS: xp-theme.css se carga antes del bundle base — todos sus overrides pierden');
if (idxFeatures > -1 && idxBase > idxFeatures) fail('CSS: features.css se carga antes del bundle base');

// layout.css lleva los overrides de grid que antes eran <style> inline DESPUÉS
// de los links. Si se mueve antes de xp-theme.css, el grid de 3 columnas deja
// de aplicar — el symptom es sutil y no lo atrapa una prueba de sintaxis.
const idxLayout = cssOrder.indexOf('layout.css');
if (idxLayout > -1 && idxXp > -1 && idxLayout < idxXp) {
  fail('CSS: layout.css tiene que cargarse después de xp-theme.css (contiene overrides de cascada)');
}

// ------------------------------------------- 6. handlers inline no existen
// index.html llama funciones desde onclick="" etc. Si la función está dentro de
// una IIFE en el JS, no existe en el scope global y el click tira
// ReferenceError en silencio — el botón queda muerto y no se nota hasta que
// alguien lo clickea.
const bundleJs = jsFiles
  .filter((f) => !f.endsWith('sw.js'))
  .map((f) => readFileSync(join(ROOT, f), 'utf8'))
  .join('\n');

const called = new Map();
for (const m of html.matchAll(/on(?:click|change|input|submit)="\s*([a-zA-Z_$][\w$]*)\s*\(/g)) {
  called.set(m[1], true);
}

// ¿La función es alcanzable desde el scope global? Vale si:
//   a) se asigna a window.<fn>,
//   b) está declarada en el nivel superior del archivo. En un bundle minificado
//      puede vivir en la mitad de una línea larguísima, así que "columna 0" no
//      sirve: hay que medir en qué nivel de llaves está la definición.
function braceDepthAt(src, idx) {
  let depth = 0;
  for (let i = 0; i < idx; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth;
}

// Percorre el archivo saltando strings y comentarios para no contar llaves
// que están dentro de un string (ej. "{" en un mensaje de log).
function topLevelFns(src) {
  const names = new Set();
  const re = /(?:^|[;}\s])(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const at = m.index;
    // nivel de llaves en el punto de la definición, ignorando strings
    let depth = 0;
    let quote = null;
    for (let i = 0; i < at; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    if (depth <= 1) names.add(name); // 0 = nivel superior, 1 = dentro de la IIFE raíz
  }
  // const/let/var en nivel superior también exponen el binding al scope global
  for (const m2 of src.matchAll(/(?:^|[\n;}])\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=/g)) {
    const at = m2.index;
    let depth = 0;
    for (let i = 0; i < at; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    if (depth <= 1) names.add(m2[1]);
  }
  return names;
}

const globalFns = topLevelFns(bundleJs);
for (const fn of called.keys()) {
  const onWindow = new RegExp(`window\\.${fn}\\s*=`).test(bundleJs);
  if (!globalFns.has(fn) && !onWindow) {
    fail(
      `HANDLER ROTO: index.html llama ${fn}() desde un atributo onclick, ` +
        `pero no está en el scope global.\n` +
        `  -> está dentro de una IIFE. Agregá "window.${fn} = ${fn};" al final del IIFE.`
    );
  }
}

// ------------------------------------------- 7. CSS balanceado y sin overflow
for (const f of cssOrder) {
  const css = readFileSync(join(ROOT, 'assets', f), 'utf8');
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  if (open !== close) fail(`CSS: ${f} tiene llaves desbalanceadas (${open} abiertas, ${close} cerradas)`);
  // un unclosed @media deja todo lo que sigue adentro y rompe media queries
  const opens = (css.match(/\{/g) || []).length;
  if (opens !== close) fail(`CSS: ${f} tiene ${opens - close} bloque(s) sin cerrar`);
}

// ------------------------------------------- resultado
console.log(`\n  assets indexados: ${refs.size}   js verificados: ${jsFiles.length}   css: ${cssOrder.join(' -> ')}\n`);
for (const w of warnings) console.log(`  warn:  ${w}`);
for (const e of errors) console.error(`  ERROR: ${e}`);

if (errors.length) {
  console.error(`\n  ${errors.length} error(es). No se despliega.\n`);
  process.exit(1);
}
console.log(`  OK — ${warnings.length} warning(s).\n`);