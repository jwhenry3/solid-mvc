/**
 * Append JSX children to an element built imperatively — works on the real
 * DOM and the worker proxy DOM (both accept nodes; strings go through the
 * ambient document's createTextNode, which resolves to the instance's
 * proxy document inside an island). Function children are evaluated once:
 * use this for static labels, not reactive content.
 */
export function appendChildren(el: { append(...nodes: any[]): void }, kids: unknown): void {
  for (const k of Array.isArray(kids) ? kids : [kids]) {
    if (k == null || typeof k === 'boolean') continue;
    const v = typeof k === 'function' ? (k as () => unknown)() : k;
    if (v == null || typeof v === 'boolean') continue;
    if (typeof v === 'string' || typeof v === 'number') {
      el.append(globalThis.document.createTextNode(String(v)) as unknown as Node);
    } else {
      el.append(v);
    }
  }
}
