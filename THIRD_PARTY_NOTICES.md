# 第三方组件与代码来源

## peek（X 帖子浮层阅读器）

本仓库的 X 支持（`src/x/xBridge.js`、`src/x/xModel.js`，以及 `src/adapters/XAdapter.js` 的引用帖/详情页判定逻辑）移植/改写自本地 peek 项目的开源实现。

- 项目：Peek · X 帖子浮层阅读器（原名「兔仔 · X 帖子浮层阅读器」）
- 仓库：https://github.com/DoraRabbitYan/peek
- 版本：0.8.10
- 许可：MIT License，Copyright (c) 2026 xuntianx
- 移植范围：GraphQL 网络层机制（页面 webpack runtime 动态发现 operation、鉴权头捕获、请求构造、游标分页）与数据层解包逻辑（`unwrapResult`、`collectTweetModels`、`parseTweetDetail`、`bottomCursor` 等）
- 未移植：其双栏 UI、点赞/回复/翻译等互动实现、hls.js 播放器

MIT 许可要求保留版权与许可声明，原文如下：

```
MIT License

Copyright (c) 2026 xuntianx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
