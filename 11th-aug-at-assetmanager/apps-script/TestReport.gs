/*
TestReport.gs - Google Apps Script for generating professional test reports

Features:
- Adds a custom menu "Test Reports" with "Open Report Generator"
- Sidebar UI to select a Test (by Procedure ID/Name), Asset, Date Range, and optional filters
- Generates a formatted Google Doc report (or a new Sheet tab) summarizing per-step results
- Pulls data from the TestResults sheet, matching columns A:Q used by the web app
- Groups by a single test session (same Asset, Procedure, Date, Timestamp)
- Supports multiple output modes: Google Doc (default) or a Sheet tab

Assumptions:
- Spreadsheet contains a sheet named per GOOGLE_CONFIG.SHEETS.TEST_RESULTS (e.g., "TestResults")
- Columns in A:Q are:
  A Asset ID | B Asset Name | C Asset Type | D Procedure ID | E Procedure Name | F Date | G Timestamp |
  H Technicians | I Contractors | J Step Number | K Step Description | L Step Result |
  M Performed By | N Performed At | O Step Notes | P Overall Status | Q Overall Notes
- Data rows start at row 2 (row 1 is headers)
*/

const CONFIG = {
  TEST_RESULTS_SHEET: 'TestResults',
  HEADER_ROW: 1,
  HEADERS: [
    'Asset ID','Asset Name','Asset Type','Procedure ID','Procedure Name','Date','Timestamp',
    'Technicians','Contractors','Step Number','Step Description','Step Result',
    'Performed By','Performed At','Step Notes','Overall Status','Overall Notes'
  ],
  // Output options
  DOC_HEADER_LOGO_URL: '', // Optional: put a public image URL here
  FOLDER_NAME_FOR_DOCS: 'Generated Test Reports' // Created under the spreadsheet parent folder if possible
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Test Reports')
    .addItem('Open Report Generator', 'openReportSidebar')
    .addToUi();
}

function openReportSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('ReportSidebar')
    .setTitle('Generate Test Report')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

// --- Data Access Helpers ---
function parseDdMmYyyy_(str) {
  if (!str) return null;
  const parts = String(str).split(/[\/-]/);
  if (parts.length !== 3) return null;
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const yyyy = parseInt(parts[2], 10);
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
  return new Date(yyyy, mm, dd);
}

function parseYyyyMmDd_(str) {
  if (!str) return null;
  const parts = String(str).split('-');
  if (parts.length !== 3) return null;
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const dd = parseInt(parts[2], 10);
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
  return new Date(yyyy, mm, dd);
}
function getTestResultsData_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.TEST_RESULTS_SHEET);
  if (!sh) throw new Error('Sheet not found: ' + CONFIG.TEST_RESULTS_SHEET);
  const rng = sh.getDataRange();
  const values = rng.getValues();
  if (values.length <= CONFIG.HEADER_ROW) return { headers: [], rows: [] };
  const headers = values[CONFIG.HEADER_ROW - 1];
  const rows = values.slice(CONFIG.HEADER_ROW);
  return { headers, rows };
}

function listProcedures_() {
  const { rows } = getTestResultsData_();
  const set = new Map();
  rows.forEach(r => {
    const procId = String(r[3] || '').trim();
    const procName = String(r[4] || '').trim();
    if (procId || procName) {
      const key = procId + '|' + procName;
      if (!set.has(key)) set.set(key, { id: procId, name: procName });
    }
  });
  return Array.from(set.values()).sort((a,b) => a.name.localeCompare(b.name || ''));
}

function listAssetsForProcedure_(procedureId) {
  const { rows } = getTestResultsData_();
  const set = new Map();
  rows.forEach(r => {
    const rProc = String(r[3] || '').trim();
    const selProc = String(procedureId || '').trim();
    if (selProc && rProc === selProc) {
      const assetId = String(r[0] || '').trim();
      const assetName = String(r[1] || '').trim();
      const key = assetId + '|' + assetName;
      if (!set.has(key)) set.set(key, { id: assetId, name: assetName });
    }
  });
  return Array.from(set.values()).sort((a,b) => a.name.localeCompare(b.name || ''));
}

function listSessions_(procedureId, assetId, onlyDateStr) {
  const { rows } = getTestResultsData_();
  const sessions = new Map(); // unfiltered by date
  const onlyDate = parseYyyyMmDd_(onlyDateStr); // from sidebar input type=date
  const selProc = String(procedureId || '').trim();
  const selAsset = String(assetId || '').trim();

  function getRowDate_(val) {
    if (!val) return null;
    if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val)) {
      return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    const s = String(val).trim();
    // Try dd/mm/yyyy first (expected in column F)
    const dmy = parseDdMmYyyy_(s);
    if (dmy) return new Date(dmy.getFullYear(), dmy.getMonth(), dmy.getDate());
    // Fallback: try yyyy-mm-dd
    const ymd = parseYyyyMmDd_(s);
    if (ymd) return new Date(ymd.getFullYear(), ymd.getMonth(), ymd.getDate());
    return null;
  }

  function normalizeDateString_(val) {
    const d = getRowDate_(val);
    if (!d) return String(val || '').trim();
    const dd = ('0' + d.getDate()).slice( -2 );
    const mm = ('0' + (d.getMonth()+1)).slice( -2 );
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  rows.forEach(r => {
    const rProc = String(r[3] || '').trim();
    const rAsset = String(r[0] || '').trim();
    if (selProc && rProc !== selProc) return;
    if (selAsset && rAsset !== selAsset) return;

    const dateVal = r[5]; // Could be Date or string (dd/mm/yyyy)
    const ts = String(r[6] || '').trim();      // Timestamp ISO or human-readable

    // Build a robust session key: prefer timestamp, else normalized date
    const normDate = normalizeDateString_(dateVal);
    const base = [rAsset, rProc];
    const sessionKey = (ts ? base.concat(ts) : base.concat(normDate)).join('|');

    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        assetId: String(r[0]||'').trim(), assetName: String(r[1]||'').trim(), assetType: r[2],
        procedureId: String(r[3]||'').trim(), procedureName: String(r[4]||'').trim(),
        date: normDate, timestamp: ts,
        technicians: r[7], contractors: r[8],
        rows: []
      });
    }
    sessions.get(sessionKey).rows.push({
      stepNumber: r[9],
      description: r[10],
      result: r[11],
      performedBy: r[12],
      performedAt: r[13],
      notes: r[14],
      overallStatus: r[15],
      overallNotes: r[16]
    });
  });

  // Sort rows within each session by step number
  sessions.forEach(s => s.rows.sort((a,b) => Number(a.stepNumber) - Number(b.stepNumber)));

  // Convert to array
  const allSessions = Array.from(sessions.values());

  // Apply optional date filter at the end
  let result = allSessions;
  if (onlyDate) {
    result = allSessions.filter(s => {
      const d = getRowDate_(s.date);
      return d && d.getFullYear() === onlyDate.getFullYear() && d.getMonth() === onlyDate.getMonth() && d.getDate() === onlyDate.getDate();
    });
    // Fallback: if filtering produced zero, return unfiltered sessions to avoid empty UI
    if (result.length === 0) result = allSessions;
  }

  // Sort for display
  return result.sort((a,b) => {
    // Sort by parsed date (from normalized date), then by timestamp string, then asset name
    const da = getRowDate_(a.date) || new Date(0);
    const db = getRowDate_(b.date) || new Date(0);
    if (da - db !== 0) return da - db;
    if (a.timestamp !== b.timestamp) return String(a.timestamp).localeCompare(String(b.timestamp));
    return String(a.assetName).localeCompare(String(b.assetName));
  });
}

// Exposed to client (sidebar)
function gsListProcedures() {
  return listProcedures_();
}
function gsListAssetsForProcedure(procedureId) {
  return listAssetsForProcedure_(procedureId);
}
function gsListSessions(procedureId, assetId, onlyDateStr) {
  return listSessions_(procedureId, assetId, onlyDateStr);
}

// --- Report Generation ---
function generateReportForSession(sessionKey) {
  // sessionKey is a packed object stringified from the sidebar
  const obj = JSON.parse(sessionKey);
  const sessions = listSessions_(obj.procedureId, obj.assetId, obj.onlyDate);

  const match = sessions.find(s => s.assetId === obj.assetId && s.procedureId === obj.procedureId && s.timestamp === obj.timestamp);
  if (!match) throw new Error('Selected session not found.');
  return createDocumentReport_(match);
}

function createDocumentReport_(session) {
  const ss = SpreadsheetApp.getActive();
  const parent = ss.getId();
  // Format date (session.date is dd/mm/yyyy) into ISO-like yyyy-mm-dd for filename friendliness
  function formatDateForFile(dateStr) {
    const m = /^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{4})$/.exec(String(dateStr));
    if (m) {
      const dd = ('0'+m[1]).slice(-2); const mm = ('0'+m[2]).slice(-2); const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(dateStr).replace(/[^0-9A-Za-z_-]+/g,'_');
  }
  const fileDate = formatDateForFile(session.date);
  let folder = null;
  try {
    const file = DriveApp.getFileById(parent);
    const parentFolders = file.getParents();
    if (parentFolders.hasNext()) {
      const parentFolder = parentFolders.next();
      // Create/find subfolder
      const existing = parentFolder.getFoldersByName(CONFIG.FOLDER_NAME_FOR_DOCS);
      folder = existing.hasNext() ? existing.next() : parentFolder.createFolder(CONFIG.FOLDER_NAME_FOR_DOCS);
    }
  } catch (e) {
    // Ignore; will create in My Drive
  }
  // New naming pattern: Test Report - yyyy-mm-dd - AssetName - ProcedureName
  const doc = DocumentApp.create(`Test Report - ${fileDate} - ${session.assetName} - ${session.procedureName}`);
  if (folder) {
    // Move file into folder
    const docFile = DriveApp.getFileById(doc.getId());
    DriveApp.getRootFolder().removeFile(docFile);
    folder.addFile(docFile);
  }

  const body = doc.getBody();
  // Optional logo at top
  if (CONFIG.DOC_HEADER_LOGO_URL) {
    try {
      const resp = UrlFetchApp.fetch(CONFIG.DOC_HEADER_LOGO_URL);
      const blob = resp.getBlob();
      const img = body.appendImage(blob);
      img.setHeight(50);
      body.appendParagraph('');
    } catch (e) { /* ignore logo errors */ }
  }
  // Title and subtitle
  const title = body.appendParagraph('Test Report');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const subtitle = body.appendParagraph(`${session.procedureName}`);
  subtitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Meta info table
  const meta = [
    ['Asset ID', session.assetId, 'Asset Name', session.assetName],
    ['Asset Type', session.assetType, 'Date', session.date],
    ['Procedure ID', session.procedureId, 'Timestamp', session.timestamp],
    ['Technicians', session.technicians || '-', 'Contractors', session.contractors || '-']
  ];
  const metaTable = body.appendTable(meta.map(r => r.map(c => String(c))));
  // Style meta table: shade label cells and bold labels
  for (let r = 0; r < metaTable.getNumRows(); r++) {
    const row = metaTable.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6).setPaddingRight(6);
      if (c % 2 === 0) { // label columns 0 and 2
        cell.setBackgroundColor('#eeeeee');
        cell.editAsText().setBold(true);
      }
    }
  }

  body.appendParagraph('');
  body.appendParagraph('Step Results').setHeading(DocumentApp.ParagraphHeading.HEADING2);

  // Steps table
  const stepsHeader = ['Step #', 'Description', 'Result', 'Performed By', 'Performed At', 'Notes'];
  const stepsData = session.rows.map(r => [
    String(r.stepNumber || ''), String(r.description || ''), String(formatResultText_(r.result)),
    String(r.performedBy || ''), String(r.performedAt || ''), String(r.notes || '')
  ]);
  const stepsTable = body.appendTable([stepsHeader].concat(stepsData));
  // Style header row
  const headerRow = stepsTable.getRow(0);
  headerRow.editAsText().setBold(true);
  for (let c = 0; c < headerRow.getNumCells(); c++) {
    headerRow.getCell(c).setBackgroundColor('#f5f5f5');
  }
  // Zebra striping and color results column
  for (let r = 1; r < stepsTable.getNumRows(); r++) {
    const row = stepsTable.getRow(r);
    if (r % 2 === 0) {
      for (let c = 0; c < row.getNumCells(); c++) {
        row.getCell(c).setBackgroundColor('#fafafa');
      }
    }
    const resultCell = row.getCell(2); // Result
    const text = resultCell.getText();
    const color = text.toLowerCase() === 'pass' ? '#1b5e20' : (text ? '#b71c1c' : '#212121');
    resultCell.editAsText().setForegroundColor(color).setBold(true);
  }

  body.appendParagraph('');
  // Overall status and notes
  const overall = session.rows.find(r => r.overallStatus || r.overallNotes) || {};
  const statusText = String(overall.overallStatus || deriveOverallStatus_(session.rows));
  const notesText = String(overall.overallNotes || '');

  const statusPara = body.appendParagraph(`Overall Status: ${statusText.toUpperCase()}`);
  statusPara.editAsText().setBold(true);
  statusPara.setForegroundColor(statusText.toLowerCase() === 'passed' ? '#1b5e20' : '#b71c1c');
  if (notesText) {
    body.appendParagraph(`Overall Notes: ${notesText}`);
  }

  doc.saveAndClose();
  return { docId: doc.getId(), url: doc.getUrl(), name: doc.getName() };
}

function deriveOverallStatus_(rows) {
  const anyFail = rows.some(r => String(r.result || '').toLowerCase() === 'fail');
  return anyFail ? 'failed' : 'passed';
}

function formatResultText_(val) {
  const s = String(val || '').toLowerCase();
  if (s === 'pass') return 'Pass';
  if (s === 'fail') return 'Fail';
  return s || '-';
}

// Optionally: generate as a Sheet tab instead of Doc
function generateSheetReportForSession(sessionKey) {
  const obj = JSON.parse(sessionKey);
  const sessions = listSessions_(obj.procedureId, obj.assetId, obj.onlyDate);
  const match = sessions.find(s => s.assetId === obj.assetId && s.procedureId === obj.procedureId && s.timestamp === obj.timestamp);
  if (!match) throw new Error('Selected session not found.');

  const ss = SpreadsheetApp.getActive();
  function formatDateForFile(dateStr) {
    const m = /^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{4})$/.exec(String(dateStr));
    if (m) {
      const dd = ('0'+m[1]).slice(-2); const mm = ('0'+m[2]).slice(-2); const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(dateStr).replace(/[^0-9A-Za-z_-]+/g,'_');
  }
  const fileDate = formatDateForFile(match.date);
  const name = `Report_${fileDate}_${match.assetName}_${match.procedureName}`.replace(/[^A-Za-z0-9_\- ]/g, '_').slice(0, 95);
  const sh = ss.insertSheet(name);

  // Title and subtitle
  sh.getRange(1,1).setValue('Test Report').setFontWeight('bold').setFontSize(18);
  sh.getRange(2,1).setValue(match.procedureName).setFontWeight('bold').setFontSize(12);

  // Meta info (4 columns, consistent width)
  const metaRows = [
    ['Asset ID', match.assetId, 'Asset Name', match.assetName],
    ['Asset Type', match.assetType, 'Date', match.date],
    ['Procedure ID', match.procedureId, 'Timestamp', match.timestamp],
    ['Technicians', match.technicians || '-', 'Contractors', match.contractors || '-']
  ];
  sh.getRange(4,1,metaRows.length, 4).setValues(metaRows);
  // Style meta labels
  const metaLabelRange = sh.getRange(4,1,metaRows.length, 1).offset(0,0); // col A labels
  const metaLabelRange2 = sh.getRange(4,3,metaRows.length, 1); // col C labels
  metaLabelRange.setFontWeight('bold').setBackground('#eeeeee');
  metaLabelRange2.setFontWeight('bold').setBackground('#eeeeee');

  // Steps table
  const header = ['Step #','Description','Result','Performed By','Performed At','Notes'];
  const data = match.rows.map(r => [r.stepNumber, r.description, r.result, r.performedBy, r.performedAt, r.notes]);
  const startRow = 4 + metaRows.length + 2;
  sh.getRange(startRow,1,1,header.length).setValues([header]).setFontWeight('bold').setBackground('#f5f5f5');
  if (data.length) sh.getRange(startRow+1,1,data.length,header.length).setValues(data);

  // Formatting
  sh.setFrozenRows(startRow);
  sh.getRange(startRow+1,2,data.length || 1,1).setWrap(true); // Description
  sh.getRange(startRow+1,6,data.length || 1,1).setWrap(true); // Notes
  // Column widths
  sh.setColumnWidths(1, 1, 70); // Step #
  sh.setColumnWidths(2, 1, 400); // Description
  sh.setColumnWidths(3, 1, 100); // Result
  sh.setColumnWidths(4, 1, 180); // Performed By
  sh.setColumnWidths(5, 1, 160); // Performed At
  sh.setColumnWidths(6, 1, 300); // Notes
  return { sheetName: name };
}
