# dsh-extra-folders

给一个工作区多挂几个可写文件夹。装好以后，侧栏工作区行的菜单里多一项「添加文件夹」，选进来的文件夹对这个工作区的会话可写，文件工具和 shell 都认，写到那里不用再逐次点授权。

| 工作区菜单 | 对话框 |
| --- | --- |
| ![工作区菜单里的「添加文件夹」](assets/menu.png) | ![添加文件夹对话框](assets/dialog.png) |

## 安装

需要 DSH 0.2.2-alpha.3 及以上。

### 方式一：在插件页添加

**设置 → Plugins → Add plugin**，把下面这行粘进去：

```text
dsh-extra-folders@latest
```

装完确认插件行是开着的。

### 方式二：命令行

```sh
dsh plugin --profile desktop add dsh-extra-folders@latest
```

想跟还没发版的改动，可以改用源码安装：`github:kingOfSoySauce/dsh-extra-folders`。

### 方式三：让 Agent 装

<details>
<summary><strong>点击展开提示词</strong></summary>

```text
请帮我把 dsh-extra-folders 装到当前 profile：
npm 包 dsh-extra-folders@latest（源码 https://github.com/kingOfSoySauce/dsh-extra-folders）

先只读确认三件事：宿主是桌面端还是 Web、当前 profile 名、dsh 版本是否 >= 0.2.2-alpha.3。
版本不够就直接告诉我，不要尝试安装。

桌面端优先用 Plugins → Add plugin，粘贴
dsh-extra-folders@latest
如果当前宿主提供了插件管理工具，也可以执行
dsh plugin --profile <profile> add dsh-extra-folders@latest。

装完核对插件行是启用状态。需要重启时告诉我，由我自己重启。
不要手改 profile 的 package.json，不要动其他插件。
装好后带我到侧栏工作区行的更多菜单，确认里面有「添加文件夹」。
```

</details>

## 使用

侧栏工作区行 → 行尾的更多按钮 → **添加文件夹**。

弹框第一行是工作区本身，它一直可写，不能移除。下面是你添加的文件夹，可以单独移除。添加和移除都立即生效，不用刷新，也不用等下一个会话。

授权跟着工作区走。子 agent 也算在内，其他工作区的会话看不到这些文件夹。

## 优点

- **只动一个点**：包装 `sandboxPolicy.resolve()`，不替换文件系统或沙箱实现。
- **不新增工具**：模型侧没有新工具，只有 DSH 自己渲染的那一行会更新。
- **没有运行时依赖**：宿主和客户端各一个文件，不需要构建。
- **关掉就还原**：禁用插件后回到原生行为。
- **模型不能自己加目录**：只有人手动的操作会生效。

## 兼容性

| 环境 | 状态 |
| --- | --- |
| macOS 桌面端 0.2.2-rc.1 | 已验证 |
| DSH 0.2.2-alpha.3 及以上 | 支持 |
| DSH 0.2.1 及更早 | 不支持。内核没有 `additionalWritableRoots`，也没有工作区菜单服务 |
| Web（`dsh web`） | 代码与桌面端相同，文件夹选择器换成应用内浏览。未实测 |
| Windows | 只对文件工具生效，沙箱里的 shell 不受影响。这条限制来自 DSH 本身，未实测 |

宿主启动时会检查内核。不支持就写一条明确日志并退出，不会留下一个点了没反应的菜单。

## 更新与卸载

更新：拉最新代码，然后在 Plugins 里把插件行关掉再打开。

```sh
cd /绝对路径/dsh-extra-folders && git pull
```

卸载：

```sh
dsh plugin --profile desktop remove dsh-extra-folders
```

也可以在 Plugins 里直接移除。

## 遇到问题

| 现象 | 处理 |
| --- | --- |
| 菜单里没有「添加文件夹」 | 确认插件行开着，刷新一次页面；dsh 低于 0.2.2-alpha.3 不会有这一项 |
| 加了文件夹还是弹授权 | 看会话权限是不是 `read-only`，这个模式下附加文件夹不生效 |
| 老会话还在弹授权，或者先问一句要不要申请 | 新开一个会话。之前几轮的审批习惯会延续下来，新加的授权不会改写已经形成的对话惯性 |
| 选了文件夹却没加上 | 插件只收真实目录，选了软链接会被拒绝，选它指向的路径 |
| Windows 上 bash 写不进去 | DSH 只给文件工具放行附加目录，这是 DSH 的限制，插件改不了 |
| Web 端点开但没有系统选择器 | Web 端由应用内浏览代替系统对话框 |

## License

MIT
