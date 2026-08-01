import { BaseAdapter } from './BaseAdapter.js';

export class CiliAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'Cili';
  }
  match(hostname) {
    return hostname.includes('cili.');
  }
  parseClick(event) {
    const tableRow = event.target.closest?.('tr');
    if (!tableRow) return null;
    const firstTd = tableRow.querySelector('td:first-child');
    if (!firstTd || !firstTd.contains(event.target)) return null;
    const link = firstTd.querySelector('a');
    if (!link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    const title = (link.querySelector('b')?.textContent || link.textContent || '').trim() || '查看内容';
    return { url, title, element: link };
  }
  enhance(doc) {
    doc.querySelectorAll('tr').forEach((row) => {
      const firstCell = row.querySelector('td:first-child');
      const link = firstCell?.querySelector('a');
      if (firstCell && link && link.href && !link.href.startsWith('javascript:')) {
        firstCell.classList.add('popup-trigger');
      }
    });
  }
}
