import { BaseAdapter } from './BaseAdapter.js';

export class LinuxAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'LinuxDo';
  }
  match(hostname) {
    return hostname === 'linux.do';
  }
  parseClick(event) {
    const link = event.target.closest?.('a.title.raw-link.raw-topic-link');
    if (!link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: (link.textContent || '').trim() || '查看主题', element: link };
  }
  enhance() {}
}
