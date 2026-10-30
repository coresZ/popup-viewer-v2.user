// X 阅读器共用的纯格式化函数（无 DOM 依赖，可在 node 下单测）。
// 数字与时间的写法全阅读器只有这一份：列表、评论卡、资料卡都从这里取，避免「1.2K」「1.2万」混用。

/** 截断到一位小数并去掉多余的 .0（截断而非四舍五入：99999 显示 9.9万，不会跳成 10.0万） */
function oneDecimal(value) {
  const truncated = Math.floor(value * 10) / 10;
  return Number.isInteger(truncated) ? String(truncated) : truncated.toFixed(1);
}

/**
 * 计数：与 X 中文界面一致。
 *   < 1 万：千分位整数（1,234）
 *   < 1 亿：x.x万
 *   其余：x.x亿
 */
export function formatCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 100000000) return `${oneDecimal(n / 10000)}万`;
  return `${oneDecimal(n / 100000000)}亿`;
}

/** 解析 X 的时间（ISO、X 的 "Wed Oct 10 20:19:24 +0000 2018" 或毫秒时间戳）；无效返回 null */
export function parseTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? new Date(value) : null;
  const text = String(value || '').trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 相对时间（行内显示）：刚刚 / 5分钟 / 3小时 / 2天 / 10月3日 / 2023年10月3日。
 * 一周内用相对值，更早的用日期；跨年才写年份。
 */
export function relativeTime(value, now = Date.now()) {
  const date = parseTime(value);
  if (!date) return '';
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const seconds = Math.round((nowMs - date.getTime()) / 1000);
  // 本地时钟略慢于 X 服务器时，新帖会得到负数：按「刚刚」处理
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天`;
  const current = new Date(nowMs);
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  return date.getFullYear() === current.getFullYear() ? monthDay : `${date.getFullYear()}年${monthDay}`;
}

/** 完整时间（放在 title 里）：2018年10月10日 20:19 */
export function fullTime(value) {
  const date = parseTime(value);
  if (!date) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 「x 分钟前更新」：评论卡头部用，提示看的是不是旧数据 */
export function sinceLabel(at, now = Date.now()) {
  if (!at) return '';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return '刚刚更新';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  return `${Math.round(hours / 24)} 天前更新`;
}
