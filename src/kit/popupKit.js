import kitStyle from './kit.css';
import { gm } from '../utils/gm.js';
import { config } from '../config.js';
import { LoaderManager } from '../core/LoaderManager.js';
import { KitPopupPanel } from './KitPopupPanel.js';

/**
 * PopupKit：把 popup-viewer-v2 的弹窗能力（多加载器 + 安全净化 + 增强面板）
 * 封装为独立库脚本，暴露 window.PopupKit，供其他油猴脚本 @require 使用。
 *
 * 特性：
 * - 自包含样式（pvk- 前缀），与主脚本/其他脚本完全隔离
 * - 不依赖 SettingsManager，通过 open 参数注入行为
 * - 支持尺寸（width/height）与生命周期回调（onOpen/onClose）
 */
function createPopupKit() {
  gm.addStyle(kitStyle);
  const loaderManager = new LoaderManager();
  const panel = new KitPopupPanel();
  panel.setHandlers({
    onOpen: (opts) => {
      kit._onOpen?.({ url: opts.url, title: opts.title });
    },
    onClose: (info) => {
      kit._onClose?.(info);
    }
  });

  function hostnameOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  const kit = {
    version: '1.1.0',
    /**
     * 在页内弹窗打开一个 URL（多加载器自动选择：iframe 直载 / 抓取净化 / 缓存）。
     * @param {{url:string,title?:string,width?:string,height?:string,linkIntercept?:boolean}} opts
     */
    open(opts) {
      const url = opts && opts.url;
      if (!url) return false;
      const title = (opts.title || '').trim() || '查看内容';
      panel.open({
        url,
        title,
        width: opts.width,
        height: opts.height,
        load: (container, { onError, onLoad }) => {
          const hostname = hostnameOf(url);
          return loaderManager.load(url, {
            container,
            hostname,
            keepScripts: loaderManager.keepScriptsFor(hostname),
            linkIntercept: opts.linkIntercept,
            loadingSelector: '#pvk-loading',
            onError,
            onLoad
          });
        }
      });
      return true;
    },
    close() {
      panel.close();
    },
    /** 刷新当前内容（保持窗体位置与尺寸） */
    refresh() {
      panel.refresh();
    },
    /** 当前是否已打开 */
    isOpen() {
      return !!panel.panel && panel.panel.classList.contains('visible');
    },
    /** 是否有缓存内容（供宿主脚本悬停预热判断） */
    hasCached(url) {
      return loaderManager.hasCached(url);
    },
    /** 后台预热某个 URL（点击时立即渲染） */
    prefetch(url) {
      loaderManager.prefetch(url);
    },
    get config() {
      return config;
    },
    // 生命周期回调（由宿主脚本设置）
    _onOpen: null,
    _onClose: null
  };
  return kit;
}

const kit = createPopupKit();
if (typeof window !== 'undefined') {
  window.PopupKit = kit;
}
