/** Encode untrusted text for a CSV that may be opened in Excel/Sheets. */
export function safeCsvCell(value:unknown):string {
  let text=String(value??'');
  // Leading spaces and control chars must not bypass the spreadsheet formula check.
  if(/^[\s\u0000-\u001f]*[=+@-]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function safeCsv(rows:unknown[][]):string {
  return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}
