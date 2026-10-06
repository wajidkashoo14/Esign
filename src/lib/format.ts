export function fmtDateTime(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "-";
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}
