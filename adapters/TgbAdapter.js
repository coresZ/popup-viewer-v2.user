import { BaseAdapter } from './BaseAdapter.js';

export class TgbAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'TGB';
  }
  match(hostname, pathname) {
    if (hostname === 'shuo.tgb.cn') return pathname.startsWith('/livenews/');
    return hostname === 'www.tgb.cn';
  }
  parseClick(event) {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    if (hostname === 'www.tgb.cn') {
      if (pathname.startsWith('/blog/') || pathname.startsWith('/user/blog/')) {
        return this._parseBlog(event);
      }
      if (pathname.startsWith('/spmatch/')) {
        return this._parseSpmatch(event);
      }
      return this._parseGeneric(event);
    }
    if (hostname === 'shuo.tgb.cn' && pathname.startsWith('/livenews/')) {
      return this._parseLivenews(event);
    }
    return null;
  }
  _parseBlog(event) {
    const titleDiv = event.target.closest?.('div.tittle_data');
    const link = titleDiv?.querySelector('a');
    if (!titleDiv || !link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: link.title || (link.textContent || '').trim() || '查看博客', element: link };
  }
  _parseSpmatch(event) {
    const link = event.target.closest?.('.Nbbs-tiezi-lists a');
    if (!link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: link.title || (link.textContent || '').trim() || '查看内容', element: link };
  }
  _parseGeneric(event) {
    const target = event.target;
    const titleDiv = target.closest?.('div.items-content-tittle.popup-trigger');
    const remarkDiv = target.closest?.('div.items-content-remark.popup-trigger');
    const container = titleDiv || remarkDiv;
    if (!container || !container.closest('div.items-list-content')) return null;
    let linkElement = null;
    let url = null;
    if (container.parentElement?.tagName === 'A') {
      linkElement = container.parentElement;
      url = this.resolveHref(linkElement.getAttribute('href'), window.location.href);
    } else {
      linkElement = container.querySelector('a');
      if (linkElement) {
        url =
          this.resolveHref(linkElement.dataset.href, window.location.href) ||
          this.resolveHref(linkElement.getAttribute('href'), window.location.href);
      }
    }
    if (!linkElement || !url) return null;
    return {
      url,
      title:
        linkElement.title ||
        (linkElement.textContent || '').trim() ||
        (container.textContent || '').trim() ||
        '淘股吧内容',
      element: linkElement
    };
  }
  _parseLivenews(event) {
    const link = event.target.closest?.('div.items-content-tittle a');
    if (!link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: (link.textContent || '').trim() || '查看资讯', element: link };
  }
  enhance(doc) {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    if (hostname === 'shuo.tgb.cn' && pathname.startsWith('/livenews/')) {
      doc.querySelectorAll('div.items-content-tittle').forEach((titleDiv) => {
        const link = titleDiv.querySelector('a');
        if (link && link.href && !link.href.startsWith('javascript:')) {
          titleDiv.classList.add('popup-trigger');
        }
      });
      return;
    }
    if (hostname !== 'www.tgb.cn') return;
    if (pathname.startsWith('/blog/') || pathname.startsWith('/user/blog/')) {
      doc.querySelectorAll('div.article_tittle').forEach((articleTitleDiv) => {
        const titleDataDiv = articleTitleDiv.querySelector('div.tittle_data');
        const link = titleDataDiv?.querySelector('a');
        if (titleDataDiv && link && link.href && !link.href.startsWith('javascript:')) {
          titleDataDiv.classList.add('popup-trigger');
        }
      });
      return;
    }
    if (pathname.startsWith('/spmatch/')) {
      doc.querySelectorAll('.Nbbs-tiezi-lists a').forEach((link) => {
        if (link.href && !link.href.startsWith('javascript:')) {
          link.classList.add('popup-trigger');
        }
      });
      return;
    }
    doc.querySelectorAll('div.items-content-tittle, div.items-content-remark').forEach((containerDiv) => {
      if (!containerDiv.closest('div.items-list-content')) return;
      let linkElement = null;
      let url = null;
      const innerLink = containerDiv.querySelector('a');
      if (innerLink) {
        linkElement = innerLink;
        url =
          this.resolveHref(innerLink.dataset.href, window.location.href) ||
          this.resolveHref(innerLink.getAttribute('href'), window.location.href);
      } else if (containerDiv.parentElement?.tagName === 'A') {
        linkElement = containerDiv.parentElement;
        url = this.resolveHref(linkElement.getAttribute('href'), window.location.href);
      }
      if (linkElement && url) containerDiv.classList.add('popup-trigger');
    });
  }
}
