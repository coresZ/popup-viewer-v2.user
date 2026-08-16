const PREFIX = '[PopupViewer]';

function configDebug() {
  try {
    return location.search.includes('pv2_debug');
  } catch {
    return false;
  }
}

export const logger = {
  log(...args) {
    if (configDebug()) console.log(PREFIX, ...args);
  },
  warn(...args) {
    console.warn(PREFIX, ...args);
  },
  error(...args) {
    console.error(PREFIX, ...args);
  },
  debug(...args) {
    if (configDebug()) console.debug(PREFIX, ...args);
  }
};
