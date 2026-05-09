import { AffectationType, displayDateToIso, parseTimeToMinutes } from "./time";

export interface ParsedShift {
  date: string;
  code?: string;
  vehicleCode?: string;
  affectation: AffectationType;
  affectationLabel?: string;
  startLocation: string;
  startTime: string;
  endLocation: string;
  endTime: string;
  notes?: string;
}

export type ImportFormat = "json" | "tabular" | "text" | "unknown";

export interface ImportResult {
  shifts: ParsedShift[];
  warnings: string[];
  format: ImportFormat;
}

const TIME_RE = /\b(\d{1,3}):([0-5]\d)\b/;
const TIME_RE_GLOBAL = /\b(\d{1,3}):([0-5]\d)\b/g;
const VEHICLE_RE = /\b(\d{1,3}[A-Za-zÀ-ÿ]+\/\d{1,3}|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*\/\d{1,3})\b/;
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const PT_DATE_RE = /\b(\d{2})[-/](\d{2})[-/](\d{4})\b/;

const OCR_SERVICE_LINE_RE =
  /^servi[çc]o\s+([A-Z0-9][\w-]*)\s+-\s+([^\s-][^-]*?)\s+-\s+(.+)$/i;
const OCR_CODE_ONLY_RE = /^servi[çc]o\s+([A-Z0-9][\w-]*)$/i;
const OBS_LINE_RE = /^obs(?:erva[çc][aã]o)?[:\s]+(.+)$/i;
const OCR_VEHICLE_LINE_RE = /^servi[çc]o\s+de\s+viatura[:\s]+(.+)$/i;
const OCR_LINHA_RE = /^linha[:\s]+([A-Z0-9][A-Z0-9/]*)/i;

function parseHashVehicleService(raw: string): {
  vehicleCode: string;
  subServices: string[];
  hasEntryDiff: boolean;
} | null {
  const stripped = raw.replace(/^\/|\/$/g, "").trim();
  if (!stripped.includes("#")) return null;
  const hasEntryDiff = stripped.startsWith("#");
  const parts = stripped
    .split("#")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return {
    vehicleCode: hasEntryDiff ? `#${parts[0]}` : parts[0],
    subServices: parts,
    hasEntryDiff,
  };
}

function detectAffectation(value: string): {
  type: AffectationType;
  label?: string;
} {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (!v) return { type: "normal" };
  if (/normal\s*fo\b/i.test(v)) return { type: "normalFO", label: v };
  if (lower.includes("feriado")) return { type: "normalFO", label: v };
  if (lower.includes("extra")) {
    if (/2|ii\b|tipo\s*2/i.test(v)) return { type: "extra2", label: v };
    if (/1|i\b|tipo\s*1/i.test(v)) return { type: "extra1", label: v };
    return { type: "extra1", label: v };
  }
  if (lower.includes("forma") && lower.includes("o")) return { type: "formacao", label: "Formação" };
  if (lower.includes("condução") || lower.includes("conducao")) return { type: "normal" };
  if (lower.includes("normal")) return { type: "normal", label: v };
  return { type: "normal", label: v };
}

function fixYear(yyyy: number, mm: string, dd: string): string {
  const currentYear = new Date().getFullYear();
  const y = (yyyy < currentYear - 1 || yyyy > currentYear + 2) ? currentYear : yyyy;
  return `${y}-${mm}-${dd}`;
}

function normalizeIsoDate(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const iso = ISO_DATE_RE.exec(t);
  if (iso) {
    return fixYear(Number(iso[1]), iso[2], iso[3]);
  }
  const pt = PT_DATE_RE.exec(t);
  if (pt) {
    const raw = displayDateToIso(`${pt[1]}-${pt[2]}-${pt[3]}`);
    if (!raw) return null;
    const [y, m, d] = raw.split("-");
    return fixYear(Number(y), m, d);
  }
  const native = new Date(t);
  if (!Number.isNaN(native.getTime())) {
    const yyyy = native.getFullYear();
    const mm = String(native.getMonth() + 1).padStart(2, "0");
    const dd = String(native.getDate()).padStart(2, "0");
    return fixYear(yyyy, mm, dd);
  }
  return null;
}

function normalizeTime(value: string): string | null {
  const t = value.trim();
  const m = TIME_RE.exec(t);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const lk = k.toLowerCase();
    for (const objKey of Object.keys(obj)) {
      if (objKey.toLowerCase() === lk) return obj[objKey];
    }
  }
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  const v = pick(obj, keys);
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function pickNested(
  obj: Record<string, unknown>,
  parents: string[],
  child: string[],
): string {
  const parent = pick(obj, parents);
  if (parent && typeof parent === "object") {
    return pickString(parent as Record<string, unknown>, child);
  }
  return "";
}

function shiftFromJsonObject(
  raw: Record<string, unknown>,
  fallbackDate: string | undefined,
  warnings: string[],
): ParsedShift | null {
  const dateRaw =
    pickString(raw, [
      "date",
      "data",
      "serviceDate",
      "servicedate",
      "dia",
    ]) || "";
  const date = fallbackDate ? normalizeIsoDate(fallbackDate) : normalizeIsoDate(dateRaw);
  if (!date) {
    warnings.push(`Sem data válida em: ${JSON.stringify(raw).slice(0, 80)}`);
    return null;
  }

  const code =
    pickString(raw, [
      "code",
      "servico",
      "service",
      "serviço",
      "linha",
      "duty",
    ]).trim() || undefined;
  const vehicleCode =
    pickString(raw, [
      "vehicleCode",
      "vehicle",
      "viatura",
      "servicoViatura",
      "vehicleService",
      "carro",
    ]).trim() || undefined;

  const affRaw = pickString(raw, [
    "affectation",
    "afetacao",
    "afetação",
    "tipo",
    "type",
    "tipoAfetacao",
  ]);
  const aff = detectAffectation(affRaw);

  const startLocation = (
    pickString(raw, [
      "startLocation",
      "localInicio",
      "localInício",
      "inicioLocal",
    ]) || pickNested(raw, ["start", "inicio", "início"], ["location", "local"])
  ).trim();
  const startTimeRaw =
    pickString(raw, [
      "startTime",
      "horaInicio",
      "horaInício",
      "inicioHora",
    ]) || pickNested(raw, ["start", "inicio", "início"], ["time", "hora"]);
  const endLocation = (
    pickString(raw, [
      "endLocation",
      "localFim",
      "fimLocal",
    ]) || pickNested(raw, ["end", "fim"], ["location", "local"])
  ).trim();
  const endTimeRaw =
    pickString(raw, ["endTime", "horaFim", "fimHora"]) ||
    pickNested(raw, ["end", "fim"], ["time", "hora"]);

  const startTime = normalizeTime(startTimeRaw);
  const endTime = normalizeTime(endTimeRaw);

  if (!startTime || !endTime) {
    warnings.push(`Sem horas válidas em ${date} (${code ?? "?"})`);
    return null;
  }
  if (!startLocation || !endLocation) {
    warnings.push(`Sem locais em ${date} (${code ?? "?"})`);
    return null;
  }

  const notes =
    pickString(raw, ["notes", "notas", "observacoes", "observações"]).trim() ||
    undefined;

  return {
    date,
    code,
    vehicleCode,
    affectation: aff.type,
    affectationLabel: aff.label,
    startLocation,
    startTime,
    endLocation,
    endTime,
    notes,
  };
}

function tryParseJson(
  text: string,
  fallbackDate: string | undefined,
  warnings: string[],
): ParsedShift[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const candidate =
      obj.shifts ??
      obj.data ??
      obj.items ??
      obj.services ??
      obj.servicos ??
      obj.serviços ??
      obj.results;
    if (Array.isArray(candidate)) arr = candidate;
    else arr = [obj];
  }
  const shifts: ParsedShift[] = [];
  for (const item of arr) {
    if (item && typeof item === "object") {
      const s = shiftFromJsonObject(
        item as Record<string, unknown>,
        fallbackDate,
        warnings,
      );
      if (s) shifts.push(s);
    }
  }
  return shifts;
}

function detectSeparator(line: string): RegExp | null {
  if (line.includes("\t")) return /\t+/;
  if (line.includes(";")) return /\s*;\s*/;
  if (line.includes("|")) return /\s*\|\s*/;
  if (/\s{2,}/.test(line)) return /\s{2,}/;
  return null;
}

function tryParseTabular(
  text: string,
  fallbackDate: string | undefined,
  warnings: string[],
): ParsedShift[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const sep = detectSeparator(lines[0]);
  if (!sep) return null;

  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const headerIsLabels = header.some((h) =>
    /data|servi|viatura|tipo|in[ií]cio|fim|hora|local/i.test(h),
  );
  const startIdx = headerIsLabels ? 1 : 0;

  const findCol = (...needles: string[]): number => {
    for (let i = 0; i < header.length; i++) {
      const h = header[i];
      if (needles.some((n) => h.includes(n))) return i;
    }
    return -1;
  };

  const dateCol = headerIsLabels ? findCol("data", "dia", "date") : -1;
  const codeCol = headerIsLabels
    ? findCol("servi", "linha", "duty", "code")
    : -1;
  const vehicleCol = headerIsLabels
    ? findCol("viatura", "vehicle", "carro")
    : -1;
  const typeCol = headerIsLabels ? findCol("tipo", "afetac", "type") : -1;
  const startLocCol = headerIsLabels ? findCol("local in", "in. local") : -1;
  const startTimeCol = headerIsLabels
    ? findCol("hora in", "in. hora")
    : -1;
  const endLocCol = headerIsLabels ? findCol("local fim", "fim local") : -1;
  const endTimeCol = headerIsLabels ? findCol("hora fim", "fim hora") : -1;

  const shifts: ParsedShift[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim());
    if (cols.length < 3) continue;
    const dateRaw = dateCol >= 0 ? cols[dateCol] : "";
    const date = fallbackDate ?? normalizeIsoDate(dateRaw) ?? null;
    if (!date) {
      warnings.push(`Linha ${i + 1}: data inválida (${dateRaw})`);
      continue;
    }
    const allTimes: string[] = [];
    for (const c of cols) {
      const t = normalizeTime(c);
      if (t) allTimes.push(t);
    }
    const startTime =
      (startTimeCol >= 0 && normalizeTime(cols[startTimeCol] ?? "")) ||
      allTimes[0] ||
      null;
    const endTime =
      (endTimeCol >= 0 && normalizeTime(cols[endTimeCol] ?? "")) ||
      allTimes[allTimes.length - 1] ||
      null;
    if (!startTime || !endTime) {
      warnings.push(`Linha ${i + 1}: sem horas reconhecidas`);
      continue;
    }
    const code = codeCol >= 0 ? cols[codeCol] : undefined;
    const vehicleCode = vehicleCol >= 0 ? cols[vehicleCol] : undefined;
    const aff = detectAffectation(typeCol >= 0 ? cols[typeCol] : "");
    const startLocation =
      (startLocCol >= 0 ? cols[startLocCol] : "") ||
      cols.find((c) => !TIME_RE.test(c) && c !== code && c !== vehicleCode) ||
      "";
    const endLocation =
      (endLocCol >= 0 ? cols[endLocCol] : "") ||
      [...cols]
        .reverse()
        .find(
          (c) => !TIME_RE.test(c) && c !== code && c !== vehicleCode,
        ) ||
      "";
    if (!startLocation || !endLocation) {
      warnings.push(`Linha ${i + 1}: sem locais reconhecidos`);
      continue;
    }
    shifts.push({
      date,
      code: code?.trim() || undefined,
      vehicleCode: vehicleCode?.trim() || undefined,
      affectation: aff.type,
      affectationLabel: aff.label,
      startLocation: startLocation.trim(),
      startTime,
      endLocation: endLocation.trim(),
      endTime,
    });
  }
  return shifts;
}

function tryParseText(
  text: string,
  fallbackDate: string | undefined,
  warnings: string[],
): ParsedShift[] {
  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const shifts: ParsedShift[] = [];
  for (const block of blocks) {
    const dateMatch = ISO_DATE_RE.exec(block) ?? PT_DATE_RE.exec(block);
    const dateRaw = dateMatch ? dateMatch[0] : "";
    const date = fallbackDate ?? normalizeIsoDate(dateRaw) ?? null;
    if (!date) {
      warnings.push(`Bloco sem data: ${block.slice(0, 50)}...`);
      continue;
    }
    const times: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(TIME_RE_GLOBAL);
    while ((m = re.exec(block)) != null) {
      times.push(`${m[1].padStart(2, "0")}:${m[2]}`);
    }
    if (times.length < 2) {
      warnings.push(`Bloco sem horas suficientes: ${block.slice(0, 50)}...`);
      continue;
    }
    const startTime = times[0];
    const endTime = times[times.length - 1];
    const vehicleMatch = VEHICLE_RE.exec(block);
    const vehicleCode = vehicleMatch?.[1];
    const affMatch = /(extra(?:\s+(?:tipo\s*)?(?:1|2|i|ii))?|normal)/i.exec(
      block,
    );
    const aff = detectAffectation(affMatch?.[0] ?? "");
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let startLocation = "";
    let endLocation = "";
    let code: string | undefined;
    let notes: string | undefined;
    let ocrVehicle: string | undefined;
    let ocrCarreira: string | undefined;
    let ocrAffRaw: string | undefined;
    let hashServiceWarning: string | undefined;
    for (const line of lines) {
      const obsMatch = OBS_LINE_RE.exec(line);
      if (obsMatch) {
        notes = obsMatch[1].trim();
        continue;
      }
      const svcFull = OCR_SERVICE_LINE_RE.exec(line);
      if (svcFull) {
        code = svcFull[1].trim();
        ocrVehicle = svcFull[2].trim();
        ocrAffRaw = svcFull[3].trim();
        continue;
      }
      const svcCode = OCR_CODE_ONLY_RE.exec(line);
      if (svcCode) {
        code = svcCode[1].trim();
        continue;
      }
      const linhaMatch = OCR_LINHA_RE.exec(line);
      if (linhaMatch) {
        ocrCarreira = linhaMatch[1].trim().toUpperCase();
        continue;
      }
      const viaturaMatch = OCR_VEHICLE_LINE_RE.exec(line);
      if (viaturaMatch) {
        const raw = viaturaMatch[1].trim();
        const hashed = parseHashVehicleService(raw);
        if (hashed) {
          ocrVehicle = hashed.vehicleCode;
          if (hashed.subServices.length > 1) {
            const [svc1, svc2] = hashed.subServices;
            hashServiceWarning =
              `⚠️ Serviço dividido: ${hashed.subServices.join(" + ")} — pode dar diferença ao fim de ${svc1} ou ao início de ${svc2 ?? svc1}`;
          } else if (hashed.hasEntryDiff) {
            hashServiceWarning = `⚠️ Diferença na entrada — regista a carreira e chapa`;
          }
        } else {
          ocrVehicle = raw;
        }
        continue;
      }
      const lineTimes: string[] = line.match(TIME_RE_GLOBAL) ?? [];
      if (lineTimes.length === 0) {
        if (
          !code &&
          !ISO_DATE_RE.test(line) &&
          !PT_DATE_RE.test(line) &&
          /^[A-Z0-9][A-Z0-9/\- ]{1,20}$/i.test(line)
        ) {
          code = line;
        }
        continue;
      }
      const stripped = line
        .replace(TIME_RE_GLOBAL, "")
        .replace(/[-:|]+/g, " ")
        .trim();
      if (lineTimes.includes(startTime) && !startLocation) {
        startLocation = stripped;
      }
      if (lineTimes.includes(endTime)) {
        endLocation = stripped;
      }
    }
    const rawChapa = ocrVehicle ?? vehicleCode;
    const resolvedVehicle =
      ocrCarreira && rawChapa && !rawChapa.startsWith("#")
        ? `${ocrCarreira}/${rawChapa}`
        : rawChapa;
    const resolvedAff = ocrAffRaw ? detectAffectation(ocrAffRaw) : aff;
    if (!startLocation) startLocation = "—";
    if (!endLocation) endLocation = startLocation;
    if (hashServiceWarning) warnings.push(hashServiceWarning);
    const combinedNotes = [notes, hashServiceWarning].filter(Boolean).join(" | ") || undefined;
    shifts.push({
      date,
      code: code?.trim(),
      vehicleCode: resolvedVehicle,
      affectation: resolvedAff.type,
      affectationLabel: resolvedAff.label,
      startLocation,
      startTime,
      endLocation,
      endTime,
      notes: combinedNotes,
    });
  }
  return shifts;
}

export function parseShiftImport(
  text: string,
  fallbackDate?: string,
): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { shifts: [], warnings: [], format: "unknown" };
  }
  const warnings: string[] = [];

  const json = tryParseJson(trimmed, fallbackDate, warnings);
  if (json && json.length > 0) {
    return { shifts: json, warnings, format: "json" };
  }

  const tabular = tryParseTabular(trimmed, fallbackDate, warnings);
  if (tabular && tabular.length > 0) {
    return { shifts: tabular, warnings, format: "tabular" };
  }

  const textShifts = tryParseText(trimmed, fallbackDate, warnings);
  if (textShifts.length > 0) {
    return { shifts: textShifts, warnings, format: "text" };
  }

  return {
    shifts: [],
    warnings: warnings.length
      ? warnings
      : ["Não foi possível reconhecer o formato dos dados colados"],
    format: "unknown",
  };
}

export function isValidParsedShift(shift: ParsedShift): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shift.date)) return false;
  const start = parseTimeToMinutes(shift.startTime);
  const end = parseTimeToMinutes(shift.endTime);
  if (start == null || end == null) return false;
  if (end < start) return false;
  if (!shift.startLocation || !shift.endLocation) return false;
  return true;
}
