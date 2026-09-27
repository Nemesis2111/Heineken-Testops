/**
 * parseXlsxMultiSheet
 * ─────────────────────────────────────────────────────────────
 * Pure-browser, no-dependency XLSX parser.
 *
 * Uses the ZIP Central Directory (not local-header scan) so it correctly
 * handles the data-descriptor flag (bit 3), where cSize in the local header
 * is 0 for many real xlsx files.
 *
 * Exports two APIs:
 *  - parseXlsxMultiSheet(ab)  → Record<sheetName, SheetRows>   (header-keyed rows)
 *  - parseXlsxRawGrids(ab)    → Record<sheetName, string[][]>  (zero-indexed [row][col])
 *  - parseXlsxSingleSheet(ab) → SheetRows  (first sheet, header-keyed)
 *
 * Yields the event loop between decompressing individual sheets via
 * setTimeout(0) so the browser never hangs on large workbooks.
 */

export type SheetRows = Record<string, string>[];
/** Raw 2D grid: grid[rowIndex][colIndex], both 0-based */
export type RawGrid = string[][];

// ─── DataView helpers ─────────────────────────────────────────────────────────
function u16(dv: DataView, o: number) { return dv.getUint16(o, true); }
function u32(dv: DataView, o: number) { return dv.getUint32(o, true); }
function strUtf8(buf: Uint8Array, o: number, len: number) {
  return new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(o, o + len));
}

/** Yield control back to the browser event loop */
function yieldToUI(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

// ─── Build ZIP file map via Central Directory ─────────────────────────────────
async function buildZipMap(buf: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv   = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const size = buf.length;

  // Locate End-of-Central-Directory by scanning backwards
  let eocdOff = -1;
  for (let i = size - 22; i >= Math.max(0, size - 65558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocdOff = i; break; }
  }
  if (eocdOff < 0) return new Map();

  const cdOffset = u32(dv, eocdOff + 16);
  const cdSize   = u32(dv, eocdOff + 12);
  const map      = new Map<string, Uint8Array>();

  let pos    = cdOffset;
  const cdEnd = cdOffset + cdSize;

  while (pos + 46 <= cdEnd) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break;

    const method     = u16(dv, pos + 10);
    const cSize      = u32(dv, pos + 20);
    const fnLen      = u16(dv, pos + 28);
    const extraLen   = u16(dv, pos + 30);
    const commentLen = u16(dv, pos + 32);
    const localOff   = u32(dv, pos + 42);
    const name       = strUtf8(buf, pos + 46, fnLen);

    pos += 46 + fnLen + extraLen + commentLen;

    if (localOff + 30 > size) continue;
    const localFnLen    = u16(dv, localOff + 26);
    const localExtraLen = u16(dv, localOff + 28);
    const dataOff       = localOff + 30 + localFnLen + localExtraLen;
    if (dataOff + cSize > size) continue;

    const data = buf.subarray(dataOff, dataOff + cSize);

    if (method === 0) {
      map.set(name, new Uint8Array(data));
    } else if (method === 8 && typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(new Uint8Array(data));
        writer.close();
        const chunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value!);
        }
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        map.set(name, out);
        await yieldToUI();   // <── yield after each decompression
      } catch { /* skip */ }
    }
  }

  return map;
}

function decode(raw: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(raw);
}

// ─── XML entity decode ────────────────────────────────────────────────────────
function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xa;/gi, " ")
    .replace(/&#x9;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─── Shared strings ───────────────────────────────────────────────────────────
function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let val = "";
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) val += t[1];
    result.push(unescapeXml(val).replace(/\s+/g, " ").trim());
  }
  return result;
}

// ─── Column letter(s) → 0-based index  (A→0, B→1, Z→25, AA→26 …) ─────────────
function colToIdx(letters: string): number {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

// ─── Parse sheet XML → raw 2D grid (0-based row & col) ───────────────────────
/**
 * Returns a sparse 2D array: grid[rowIdx][colIdx] = cellValue string.
 * Rows that are entirely empty are present as empty arrays (not skipped)
 * so that absolute row addressing (e.g. row 7 = index 7) stays correct.
 *
 * Row index is derived from the r attribute on <row> (1-based → 0-based).
 */
function parseSheetXmlToGrid(xml: string, shared: string[]): RawGrid {
  const grid: RawGrid = [];

  for (const rowM of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowIdx = parseInt(rowM[1], 10) - 1;   // 1-based → 0-based
    const cells: string[] = [];

    for (const cm of rowM[2].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attr  = cm[1];
      const inner = cm[2];
      const rAttr = attr.match(/r="([A-Z]+)(\d+)"/);
      if (!rAttr) continue;
      const colIdx = colToIdx(rAttr[1]);
      while (cells.length <= colIdx) cells.push("");

      const tAttr  = attr.match(/\bt="([^"]+)"/);
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      const iMatch = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
      let val = vMatch ? vMatch[1] : (iMatch ? iMatch[1] : "");

      if (tAttr) {
        switch (tAttr[1]) {
          case "s":         val = shared[parseInt(val, 10)] ?? val; break;
          case "inlineStr": val = iMatch ? iMatch[1] : val; break;
          case "b":         val = val === "1" ? "TRUE" : "FALSE"; break;
          case "str":       val = unescapeXml(val); break;
        }
      }
      cells[colIdx] = unescapeXml(val).trim();
    }

    // Ensure grid has entries up to rowIdx
    while (grid.length <= rowIdx) grid.push([]);
    grid[rowIdx] = cells;
  }

  return grid;
}

// ─── Convert raw grid → header-keyed rows (for tabular sheets) ───────────────
function gridToSheetRows(grid: RawGrid): SheetRows {
  if (grid.length < 2) return [];
  const rawHeaders = grid[0] ?? [];
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const key = (h || `Col${i + 1}`)
      .replace(/\r?\n/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const cnt = seen.get(key) ?? 0;
    seen.set(key, cnt + 1);
    return cnt === 0 ? key : `${key}_${cnt}`;
  });

  return grid.slice(1)
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const v = (row[i] ?? "").trim();
        if (v) obj[h] = v;
      });
      return obj;
    })
    .filter((obj) => Object.keys(obj).length > 0);
}

// ─── Internal: build zip + shared strings + sheet list ───────────────────────
async function loadWorkbook(ab: ArrayBuffer) {
  const buf = new Uint8Array(ab);
  const zip = await buildZipMap(buf);

  const dec = (name: string) => {
    const raw = zip.get(name);
    return raw ? decode(raw) : null;
  };

  const sharedXml = dec("xl/sharedStrings.xml");
  const shared    = sharedXml ? parseSharedStrings(sharedXml) : [];

  const wbXml    = dec("xl/workbook.xml");
  const wbRelXml = dec("xl/_rels/workbook.xml.rels");

  const relMap = new Map<string, string>();
  if (wbRelXml) {
    // Catch all attribute orders
    for (const m of wbRelXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      if (!relMap.has(m[1])) relMap.set(m[1], m[2]);
    }
  }

  const sheetList: { name: string; rId: string }[] = [];
  if (wbXml) {
    for (const m of wbXml.matchAll(/<sheet\s[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
      sheetList.push({ name: unescapeXml(m[1]), rId: m[2] });
    }
  }

  const getSheetXml = (rId: string): string | null => {
    const target = relMap.get(rId);
    if (!target) return null;
    const path = target.startsWith("/xl/") ? target.slice(1)
      : target.startsWith("xl/") ? target : `xl/${target}`;
    return dec(path);
  };

  return { sheetList, shared, getSheetXml, dec };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns each sheet as a header-keyed row array (original API). */
export async function parseXlsxMultiSheet(
  ab: ArrayBuffer
): Promise<Record<string, SheetRows>> {
  const { sheetList, shared, getSheetXml, dec } = await loadWorkbook(ab);

  if (sheetList.length === 0) {
    const s1 = dec("xl/worksheets/sheet1.xml");
    if (s1) return { Sheet1: gridToSheetRows(parseSheetXmlToGrid(s1, shared)) };
    return {};
  }

  const result: Record<string, SheetRows> = {};
  for (const { name, rId } of sheetList) {
    const xml = getSheetXml(rId);
    if (xml) {
      result[name] = gridToSheetRows(parseSheetXmlToGrid(xml, shared));
      await yieldToUI();
    }
  }
  return result;
}

/**
 * Returns each sheet as a raw 2D string grid (0-based [row][col]).
 * Use this for STATIC cell-coordinate mapping (e.g. grid[1][1] = B2).
 */
export async function parseXlsxRawGrids(
  ab: ArrayBuffer
): Promise<Record<string, RawGrid>> {
  const { sheetList, shared, getSheetXml, dec } = await loadWorkbook(ab);

  if (sheetList.length === 0) {
    const s1 = dec("xl/worksheets/sheet1.xml");
    if (s1) return { Sheet1: parseSheetXmlToGrid(s1, shared) };
    return {};
  }

  const result: Record<string, RawGrid> = {};
  for (const { name, rId } of sheetList) {
    const xml = getSheetXml(rId);
    if (xml) {
      result[name] = parseSheetXmlToGrid(xml, shared);
      await yieldToUI();
    }
  }
  return result;
}

/** Convenience: first sheet as header-keyed rows. */
export async function parseXlsxSingleSheet(ab: ArrayBuffer): Promise<SheetRows> {
  const all = await parseXlsxMultiSheet(ab);
  return Object.values(all)[0] ?? [];
}
