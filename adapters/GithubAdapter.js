import { BaseAdapter } from './BaseAdapter.js';

export class GithubAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'GitHub';
    this.linkSelector = 'a.IssuePullRequestTitle-module__ListItemTitle_1--_xOfg';
    this.parentSelector = 'div.IssueRow-module__row--XmR1f';
  }
  match(hostname, pathname) {
    return hostname === 'github.com' && pathname.includes('/issues');
  }
  parseClick(event) {
    const link = event.target.closest?.(this.linkSelector);
    if (!link) return null;
    if (!link.closest(this.parentSelector)) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: (link.textContent || '').trim() || '查看 GitHub Issue', element: link };
  }
  enhance() {}
}
