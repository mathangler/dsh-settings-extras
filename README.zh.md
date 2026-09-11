# dsh-settings-extras

[English](README.md) | 中文

给 DeepSeek Harness 的**设置面板**加上三块功能：

| 功能 | 入口 |
|---|---|
| **技能** | 设置 → 技能 |
| **用量统计** | 设置 → 用量统计 |
| **网页搜索开关** | 设置 → 插件 → 「网页搜索」卡片内 |

> **非官方。** 第三方插件，与 DeepSeek 无隶属或背书关系。

---

## 功能

### 技能

- 列出 DSH 能加载的全部技能（全局与按项目），标注来源；项目技能覆盖同名全局技能时给出提示。
- 每个技能一个开关。**关**会在该技能文件里写入 `disable-model-invocation: true`：
  技能退出模型可见的技能目录，但仍可用 `/名称` 手动调用。
- 指向其他工具的链接、或不属于 DSH 的技能显示为只读。
- **查看**就地展开该技能的 SKILL.md；**移除**删除技能目录（若是链接则只删链接本身）。
- **搜索安装**：搜索 skills.sh，每条结果给出 **GitHub** 与 **skills.sh** 两个入口，安装前由你自己查看。
  面板不会在你确认之前下载任何内容。可安装到全局技能目录，或当前项目的 `.dsh/skills`。
- **导入**：把磁盘上已有的技能目录导入，方式为**链接**（原目录仍是唯一来源）或**复制**；
  导入的技能不参与更新检查。
- **更新**：每次打开页面后在后台检查一次全部已安装技能，有变化的给出标记；更新前会先比对，
  确认没有变化就不做任何改动。

### 用量统计

- 六项指标：累计总量、峰值日、今日、近 7 天、活跃日均、cache read 占比。
- GitHub 风格日历热力图（固定 18 周窗口）与周柱图，列对得齐。
- 分模型趋势折线（按所选时间范围自动切日/周/月/年粒度）与占比环形图。
- 顶部可切指标（总量／输入+输出／输入／输出／cache read／cache write）与时间范围。
- 数据来自会话日志，fork（seeded）会话的继承前缀不会重复计数。

### 网页搜索开关

- 在「设置 → 插件 → 网页搜索」卡片里注入一个开关，实时控制 `web_search`。
- **开**：一切照旧（官方 DeepSeek 搜索提供方每次搜索计费）。
- **关**：不再向模型提供 `web_search`，也不会有任何请求发往搜索提供方（已经在途的调用同样会被拒绝）。
  `web_fetch`（本地抓取）不受影响。
- 关闭时卡片整体变灰，开关本身仍可操作；写入失败会回滚并显示原因。
- 状态存在 `$DSH_HOME/websearch-toggle.json`。

---

## 安装

需要带 `web` profile 的 DSH。

```sh
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

用 npm 的话：

```sh
cd ~/.dsh/profiles/web
npm install github:mathangler/dsh-settings-extras
# 再把 "dsh-settings-extras" 加进本目录 package.json 的 dsh.profile.bundles
```

装完重启 Web 应用：

```sh
dsh web
```

然后打开 **设置**。

## 更新

```sh
dsh plugin --profile web update dsh-settings-extras
```

用 npm 装的话：

```sh
npm update dsh-settings-extras
```

若 update 失败，也可以 remove 再 add：

```sh
dsh plugin --profile web remove dsh-settings-extras
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

## 兼容性

- DSH `0.1.5-rc.x`（实测版本）。
- 需要带 `web` profile 的 DSH。
- 用量统计依赖会话日志；读不到时面板会显示原因，而不是空白。

## 许可

MIT。
