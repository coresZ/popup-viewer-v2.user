import { BaseAdapter } from './BaseAdapter.js';

export class DiscuzAdapter extends BaseAdapter {
  constructor(hostnamePatterns = ['chiphell', 'wnflb', '52pojie']) {
    super();
    this.name = 'Discuz';
    this.patterns = hostnamePatterns;
  }
  match(hostname) {
    return this.patterns.some((p) => hostname.includes(p));
  }
  parseClick(event) {
    const link = event.target.closest?.('a.xst');
    if (link) {
      const url = this.resolveHref(link.href, window.location.href);
      if (url) {
        return { url, title: (link.textContent || '').trim() || '查看帖子', element: link };
      }
    }
    const suhTd = event.target.closest?.('td.suh');
    if (suhTd) {
      const a = event.target.closest?.('a') || suhTd.querySelector('a');
      if (a) {
        const url = this.resolveHref(a.href, window.location.href);
        if (url) {
          return {
            url,
            title: a.title || (a.textContent || '').trim() || '查看内容',
            element: a
          };
        }
      }
    }
    return null;
  }
  enhance(doc) {
    doc.querySelectorAll('a.xst').forEach((link) => {
      if (link.href && !link.href.startsWith('javascript:')) {
        const th = link.closest('th.common, th.new, th.lock');
        if (th && !th.classList.contains('common')) th.classList.add('common');
      }
    });
  }
}
