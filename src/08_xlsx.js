function exportProjectExcel() {
  const project = activeProject();
  if (!project) return;
  const workbook = createProjectExcelWorkbook(project);
  downloadBinaryFile(
    `${slugifyFilename(project.name)}-aggiornamento.xlsx`,
    workbook,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function openProjectExcelImport() {
  if (!activeProject()) return;
  if (window.webkit?.messageHandlers?.importExcel) {
    window.webkit.messageHandlers.importExcel.postMessage({});
    return;
  }
  els.importExcelInput.value = "";
  els.importExcelInput.click();
}

function handleProjectExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      await importProjectExcelUpdates(reader.result, file.name);
    } catch (error) {
      alert(`Import Excel non riuscito: ${error.message || error}`);
    } finally {
      els.importExcelInput.value = "";
    }
  });
  reader.readAsArrayBuffer(file);
}

window.loadExcelFromNative = async function loadExcelFromNative(base64, filename = "aggiornamento.xlsx") {
  try {
    await importProjectExcelUpdates(base64ToBytes(base64).buffer, filename);
  } catch (error) {
    alert(`Import Excel non riuscito: ${error.message || error}`);
  }
};

function createProjectExcelWorkbook(project) {
  const headers = [
    "Workspace ID",
    "Project ID",
    "Task ID",
    "Subtask ID",
    "Nome attività",
    "Inizio attività",
    "Due date attività",
    "Responsabile",
    "Priorità",
    "Stato",
    "Note",
    "Sotto-attività",
    "Responsabile sotto-attività",
    "Data sotto-attività",
    "Sotto-attività completata",
    "Avanzamento",
  ];
  const rows = [headers];
  project.tasks.forEach((task) => {
    const subtasks = task.subtasks.length ? task.subtasks : [{ id: "", name: "", dueDate: "", done: "" }];
    subtasks.forEach((subtask) => {
      rows.push([
        state.activeWorkspaceId,
        project.id,
        task.id,
        subtask.id || "",
        task.name,
        task.startDate || "",
        task.dueDate || "",
        task.owner || "",
        priorityOption(task.priority, true).label,
        statusForTask(task.statusId, project)?.name || "",
        task.notes || "",
        subtask.name || "",
        subtask.owner || "",
        subtask.dueDate || "",
        subtask.id ? (subtask.done ? "SI" : "NO") : "",
        `${completion(task)}%`,
      ]);
    });
  });

  return createXlsxFromRows(rows, sanitizeExcelSheetName(project.name));
}

async function importProjectExcelUpdates(buffer, filename = "") {
  const project = activeProject();
  if (!project) throw new Error("Apri prima il progetto da aggiornare.");
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = await unzipXlsx(bytes);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml") || "");
  const sheetXml = files.get("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("Il file non contiene il foglio atteso.");

  const rows = parseSheetRows(sheetXml, sharedStrings);
  if (rows.length < 2) throw new Error("Il file non contiene righe da importare.");
  const headerMap = excelHeaderMap(rows[0]);
  const required = ["Task ID", "Stato", "Note", "Subtask ID", "Sotto-attività completata"];
  const missing = required.filter((header) => headerMap[header] === undefined);
  if (missing.length) throw new Error(`Colonne mancanti: ${missing.join(", ")}`);

  const importedProjectIds = new Set(rows.slice(1).map((row) => cellByHeader(row, headerMap, "Project ID")).filter(Boolean));
  if (importedProjectIds.size && !importedProjectIds.has(project.id)) {
    const proceed = confirm("Il file Excel sembra appartenere a un altro progetto. Vuoi provare comunque a importarlo nel progetto aperto?");
    if (!proceed) return;
  }

  const taskById = new Map(project.tasks.map((task) => [task.id, task]));
  const statusByName = new Map(project.statuses.map((status) => [status.name.trim().toLowerCase(), status]));
  let updatedTasks = 0;
  let updatedSubtasks = 0;
  const skipped = [];

  rows.slice(1).forEach((row, index) => {
    const taskId = cellByHeader(row, headerMap, "Task ID");
    if (!taskId) return;
    const task = taskById.get(taskId);
    if (!task) {
      skipped.push(`riga ${index + 2}: attività non trovata`);
      return;
    }

    let changed = false;
    const nextNotes = cellByHeader(row, headerMap, "Note");
    if (task.notes !== nextNotes) {
      task.notes = nextNotes;
      changed = true;
    }

    const nextStatusName = cellByHeader(row, headerMap, "Stato").trim();
    if (nextStatusName) {
      const status = statusByName.get(nextStatusName.toLowerCase());
      if (status && task.statusId !== status.id) {
        task.statusId = status.id;
        changed = true;
      } else if (!status) {
        skipped.push(`riga ${index + 2}: stato "${nextStatusName}" non esiste`);
      }
    }

    const subtaskId = cellByHeader(row, headerMap, "Subtask ID");
    if (subtaskId) {
      const subtask = task.subtasks.find((item) => item.id === subtaskId);
      if (subtask) {
        const nextDone = parseExcelBoolean(cellByHeader(row, headerMap, "Sotto-attività completata"));
        if (nextDone !== null && subtask.done !== nextDone) {
          subtask.done = nextDone;
          updatedSubtasks += 1;
        }
      } else {
        skipped.push(`riga ${index + 2}: sotto-attività non trovata`);
      }
    }

    if (changed) updatedTasks += 1;
  });

  saveState();
  render();
  const message = [
    `Import completato${filename ? ` da ${filename}` : ""}.`,
    `${updatedTasks} attività aggiornate.`,
    `${updatedSubtasks} sotto-attività aggiornate.`,
    skipped.length ? `${skipped.length} righe saltate:\n${skipped.slice(0, 8).join("\n")}${skipped.length > 8 ? "\n..." : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  alert(message);
}

function excelHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    map[String(header || "").trim()] = index;
    return map;
  }, {});
}

function cellByHeader(row, headerMap, header) {
  const index = headerMap[header];
  return index === undefined ? "" : String(row[index] || "").trim();
}

function parseExcelBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["si", "sì", "yes", "true", "1", "x", "completata", "completato"].includes(normalized)) return true;
  if (["no", "false", "0", "aperta", "aperto", "non completata", "non completato"].includes(normalized)) return false;
  return null;
}

function createXlsxFromRows(rows, sheetName) {
  const files = new Map([
    ["[Content_Types].xml", xlsxContentTypes()],
    ["_rels/.rels", xlsxRootRels()],
    ["docProps/app.xml", xlsxAppProps()],
    ["docProps/core.xml", xlsxCoreProps()],
    ["xl/workbook.xml", xlsxWorkbookXml(sheetName)],
    ["xl/_rels/workbook.xml.rels", xlsxWorkbookRels()],
    ["xl/styles.xml", xlsxStylesXml()],
    ["xl/worksheets/sheet1.xml", xlsxSheetXml(rows)],
  ]);
  return zipStore(files);
}

function xlsxSheetXml(rows) {
  const editableColumns = new Set([10, 11, 15]);
  const rowXml = rows
    .map(
      (row, rowIndex) => `
        <row r="${rowIndex + 1}">
          ${row
            .map((value, colIndex) => {
              const ref = `${excelColumnName(colIndex + 1)}${rowIndex + 1}`;
              const editableStyle = rowIndex > 0 && editableColumns.has(colIndex + 1) ? ` s="1"` : "";
              return `<c r="${ref}"${editableStyle} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
            })
            .join("")}
        </row>`,
    )
    .join("");
  const lastRef = `${excelColumnName(rows[0]?.length || 1)}${rows.length || 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastRef}" />
  <sheetViews><sheetView workbookViewId="0" /></sheetViews>
  <sheetFormatPr defaultRowHeight="18" />
  <cols>
    <col min="1" max="4" width="14" hidden="1" customWidth="1" />
    <col min="5" max="5" width="32" customWidth="1" />
    <col min="6" max="9" width="18" customWidth="1" />
    <col min="10" max="10" width="18" customWidth="1" />
    <col min="11" max="11" width="46" customWidth="1" />
    <col min="12" max="14" width="24" customWidth="1" />
    <col min="15" max="15" width="24" customWidth="1" />
    <col min="16" max="16" width="14" customWidth="1" />
  </cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="E1:P${rows.length || 1}" />
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="O2:O1048576"><formula1>"SI,NO"</formula1></dataValidation>
  </dataValidations>
</worksheet>`;
}

function xlsxWorkbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1" /></sheets>
</workbook>`;
}

function xlsxWorkbookRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
</Relationships>`;
}

function xlsxContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
</Types>`;
}

function xlsxRootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
</Relationships>`;
}

function xlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="0" />
  <fonts count="1"><font><name val="Calibri" /><family val="2" /><color theme="1" /><sz val="11" /><scheme val="minor" /></font></fonts>
  <fills count="3">
    <fill><patternFill /></fill>
    <fill><patternFill patternType="gray125" /></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="00FFD966" /></patternFill></fill>
  </fills>
  <borders count="1"><border><left /><right /><top /><bottom /><diagonal /></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" /></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0" />
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyProtection="1" pivotButton="0" quotePrefix="0" xfId="0"><protection locked="0" hidden="0" /></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0" hidden="0" /></cellStyles>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16" />
</styleSheet>`;
}

function xlsxAppProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Gestore attività Kanban</Application>
</Properties>`;
}

function xlsxCoreProps() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Gestore attività Kanban</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagName("si")].map((item) => [...item.getElementsByTagName("t")].map((text) => text.textContent || "").join(""));
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rows = [];
  [...doc.getElementsByTagName("row")].forEach((rowEl) => {
    const row = [];
    [...rowEl.getElementsByTagName("c")].forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const colIndex = excelColumnIndex(ref.replace(/[0-9]/g, "")) - 1;
      row[colIndex] = readCellValue(cell, sharedStrings);
    });
    rows.push(row.map((value) => value || ""));
  });
  return rows;
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return cell.getElementsByTagName("t")[0]?.textContent || "";
  const value = cell.getElementsByTagName("v")[0]?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

async function unzipXlsx(bytes) {
  const files = new Map();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("File XLSX non leggibile.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  let offset = centralOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const filename = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const contentBytes = method === 0 ? compressed : await inflateRaw(compressed, uncompressedSize);
    files.set(filename, new TextDecoder().decode(contentBytes));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!files.size) throw new Error("File XLSX non leggibile.");
  return files;
}

async function inflateRaw(bytes, expectedSize = 0) {
  if (!("DecompressionStream" in window)) throw new Error("Import di file XLSX compressi non supportato da questo browser.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  files.forEach((content, filename) => {
    const nameBytes = encoder.encode(filename);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
      data,
    );
    chunks.push(local);
    central.push(
      concatBytes(
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(data.length),
        uint32(data.length),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes,
      ),
    );
    offset += local.length;
  });
  const centralStart = offset;
  const centralBytes = concatBytes(...central);
  const end = concatBytes(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.size),
    uint16(files.size),
    uint32(centralBytes.length),
    uint32(centralStart),
    uint16(0),
  );
  return concatBytes(...chunks, centralBytes, end);
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function excelColumnName(index) {
  let name = "";
  while (index > 0) {
    index -= 1;
    name = String.fromCharCode(65 + (index % 26)) + name;
    index = Math.floor(index / 26);
  }
  return name;
}

function excelColumnIndex(name) {
  return String(name || "")
    .toUpperCase()
    .split("")
    .reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
}

function sanitizeExcelSheetName(value) {
  const clean = String(value || "Progetto")
    .replace(/[\[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return clean || "Progetto";
}

function downloadBinaryFile(filename, bytes, mimeType) {
  if (window.webkit?.messageHandlers?.exportBinary) {
    window.webkit.messageHandlers.exportBinary.postMessage({ filename, mimeType, base64: bytesToBase64(bytes) });
    return;
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
