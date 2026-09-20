/* ============================================================================
 * build-data.mjs  ——  把《网站内容.xlsx》转换成网站读取的 data/content.js
 * ----------------------------------------------------------------------------
 * 用法：  node build-data.mjs
 * 依赖：  无（内置最小 xlsx 解析）
 * 说明：  Excel 是你的编辑入口；这个脚本把表格编译成静态数据文件，
 *        这样网站放到 GitHub Pages 上就不需要任何运行时解析。
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/* ---------- 读取 xlsx（zip + xml） ---------- */
function readZip(file) {
  const buf = fs.readFileSync(file);
  const eocd = (() => {
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) return i;
    }
    return -1;
  })();
  if (eocd < 0) throw new Error('不是有效的 xlsx（找不到 ZIP 结尾标记）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
    if (method === 8 && compSize > 0) {
      const ln = buf.readUInt16LE(localOff + 26);
      const le = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + ln + le;
      out[name] = zlib.inflateRawSync(buf.subarray(start, start + compSize));
    } else if (method === 0) {
      const ln = buf.readUInt16LE(localOff + 26);
      const le = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + ln + le;
      out[name] = buf.subarray(start, start + compSize);
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const dec = (s) => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g) => {
  if (g[0] === '#') {
    const c = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
    return isNaN(c) ? m : String.fromCharCode(c);
  }
  return ENT[g] !== undefined ? ENT[g] : m;
});

function parseSharedStrings(xml) {
  const out = [];
  if (!xml) return out;
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = '';
    for (const x of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += dec(x[1]);
    out.push(t);
  }
  return out;
}

function parseSheet(xml, sst) {
  const rows = [];
  const body = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (process.env.DBG) console.log('  DBG parseSheet: xmlLen=' + xml.length + ' hasSheetData=' + !!body + ' sst=' + sst.length + ' rowTags=' + (xml.match(/<row/g) || []).length);
  if (!body) return rows;
  for (const rm of body[1].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const part of rm[1].split(/<c\b/).slice(1)) {
      const ref = /^\s*r="([A-Za-z]+)\d+"/.exec(part);
      if (!ref) continue;
      const t = /^\s*[^>]*?\bt="([^"]+)"/.exec(part);
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(part);
      let val = '';
      if (t && t[1] === 'inlineStr') {
        for (const x of part.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) val += dec(x[1]);
      } else if (v) {
        const raw = dec(v[1]);
        val = (t && t[1] === 's') ? (sst[parseInt(raw, 10)] || '') : raw;
      }
      cells[ref[1].toUpperCase()] = String(val).replace(/\u00a0/g, ' ').trim();
    }
    rows.push(cells);
  }
  return rows;
}

function readSheet(file) {
  const zip = readZip(file);
  if (process.env.DBG) console.log('  DBG zip keys: ' + Object.keys(zip).join(' | '));
  const sst = parseSharedStrings(zip['xl/sharedStrings.xml'] ? zip['xl/sharedStrings.xml'].toString('utf8') : '');
  const rels = {};
  const relXml = zip['xl/_rels/workbook.xml.rels'] ? zip['xl/_rels/workbook.xml.rels'].toString('utf8') : '';
  for (const m of relXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0]);
    const tg = /\bTarget="([^"]+)"/.exec(m[0]);
    if (id && tg) rels[id[1]] = dec(tg[1]).replace(/^\/?xl\//, '');
  }
  const wb = zip['xl/workbook.xml'] ? zip['xl/workbook.xml'].toString('utf8') : '';
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nm = /\bname="([^"]*)"/.exec(m[0]);
    const rid = /r:id="([^"]+)"/.exec(m[0]);
    const target = rid ? rels[rid[1]] : '';
    const full = target ? (zip[target] ? target : ('xl/' + target)) : '';
    if (full && zip[full]) sheets.push({ name: nm ? dec(nm[1]) : '', rows: parseSheet(zip[full].toString('utf8'), sst) });
  }
  // 取数据最多的那张表（「怎么填」等说明表行数少）
  if (process.env.DBG) console.log('  DBG sheetTags=' + (wb.match(/<sheet\b[^>]*\/>/g) || []).length + ' rels=' + JSON.stringify(rels) + ' sheets=' + sheets.length);
  sheets.sort((a, b) => b.rows.length - a.rows.length);
  return sheets[0] ? sheets[0].rows : [];
}

/* ---------- 表格 -> 数据模型 ---------- */
const XLSX = process.env.CONTENT_XLSX || '网站内容.xlsx';
const file = path.join(root, XLSX);
if (!fs.existsSync(file)) { console.error('找不到表格：' + file); process.exit(1); }

const raw = readSheet(file);
if (process.env.DBG) {
  console.log('DEBUG raw rows=' + raw.length);
  console.log('DEBUG row0=' + JSON.stringify(raw[0]));
  console.log('DEBUG row12=' + JSON.stringify(raw[12]));
}
const rows = [];
raw.forEach((c, i) => {
  if (i === 0) return;
  const zh = (c.A || '').trim(), en = (c.B || '').trim();
  if (!zh && !en) return;
  rows.push({
    module: zh || en,
    moduleEn: en || zh,
    type: (c.C || '段落').trim(),
    order: isNaN(parseFloat(c.D)) ? i * 10 : parseFloat(c.D),
    titleZh: (c.E || '').trim(), titleEn: (c.F || '').trim(),
    bodyZh: (c.G || '').trim(), bodyEn: (c.H || '').trim(),
    image: (c.I || '').trim(), link: (c.J || '').trim(),
    seq: i
  });
});
rows.sort((a, b) => a.order - b.order || a.seq - b.seq);

const settings = {};
rows.forEach(r => {
  if (r.type === '设置') {
    const key = r.titleEn || r.titleZh;
    if (key) settings[key] = { zh: r.bodyZh, en: r.bodyEn };
  }
});

const pages = [];
const seen = new Set();
rows.forEach(r => {
  if (r.type === '设置' || r.module === '首页') return;
  if (seen.has(r.module)) return;
  seen.add(r.module);
  pages.push({
    id: 'p' + (pages.length + 1),
    labelZh: r.module,
    labelEn: r.moduleEn,
    items: rows.filter(x => x.module === r.module && x.type !== '设置')
  });
});

const home = rows.filter(r => r.module === '首页' && r.type !== '设置');

const data = { settings, home, pages };
const js =
  '/* 由 build-data.mjs 自动生成，请勿手工修改。\n' +
  '   要改内容请编辑《' + XLSX + '》，然后运行： node build-data.mjs  */\n' +
  'window.SITE_DATA = ' + JSON.stringify(data, null, 2) + ';\n';

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'content.js'), js, 'utf8');
fs.writeFileSync(path.join(root, 'data', 'content.json'), JSON.stringify(data, null, 2), 'utf8');

const count = (arr) => arr.reduce((n, p) => n + p.items.length, 0);
console.log('已生成 data/content.js');
console.log('  首页内容 ' + home.length + ' 条');
console.log('  切页 ' + pages.length + ' 个：' + pages.map(p => p.labelZh + '/' + p.labelEn).join('、'));
console.log('  切页内容 ' + count(pages) + ' 条；网站设置 ' + Object.keys(settings).length + ' 项');
