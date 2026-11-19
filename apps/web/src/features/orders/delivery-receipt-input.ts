// A generated receipt identity must remain stable while delivery could have
// committed. Manual entry is only for checking a receipt after a page reload.
export function canEditReceiptIdentifier(
  busy: boolean,
  uncertain: boolean,
): boolean {
  return !busy && !uncertain;
}
