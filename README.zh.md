# dsh-settings-extras

[English](README.md) | 中文

给 DeepSeek Harness 的**设置面板**加上三块功能：

| 功能 | 入口 |
|---|---|
| **技能** | 设置 → 技能 |
| **用量统计** | 设置 → 用量统计 |
| **网页搜索开关** | 设置 → 插件 → 「网页搜索」卡片内 |

> **非官方。** 第三方插件，与 DeepSeek 无隶属或背书关系，只使用 DSH 公开的插件接口。

---

## 功能

### 技能

- 列出 DSH 实际能加载的全部技能（全局与按项目），标注来源；项目技能覆盖同名全局技能时给出提示。
- 每个技能一个开关。**关**会在该技能 frontmatter 写入 `disable-model-invocation: true`：
  技能退出模型可见的技能目录，但仍可用 `/名称` 手动调用——这是 DSH 自带的机制。
- 指向其他工具的 junction、或不属于 DSH 的技能显示为只读，面板不会去改和别人共用的文件。
- **查看**就地展开该技能的 SKILL.md；**移除**删除技能目录（若技能是 junction 则只删链接本身）。
- **搜索安装**：搜索 skills.sh，每条结果给出 **GitHub** 与 **skills.sh** 两个入口，安装前由你自己查看。
  面板本身不会在你确认之前下载任何内容。可安装到全局技能目录，或当前项目的 `.dsh/skills`。
- **导入**：把磁盘上已有的技能目录导入，方式为**链接**（junction，原目录仍是唯一来源）或**复制**；
  导入的技能不参与更新检查。
- **更新**：每次打开页面后在后台检查一次全部已安装技能，有变化的给出标记；更新前会先比对，
  确认没有变化就不做任何改动。

### 用量统计

- 六项指标：累计总量、峰值日、今日、近 7 天、活跃日均、cache read 占比。
- GitHub 风格日历热力图（固定 18 周窗口）与周柱图，两者共享同一几何，列对得齐。
- 分模型趋势折线（按所选时间范围自动切日/周/月/年粒度）与占比环形图。
- 顶部可切指标（总量／输入+输出／输入／输出／cache read／cache write）与时间范围。
- 数据取自会话日志里的 `assistant/message` usage 记录；fork（seeded）会话的继承前缀会跳过，
  不会重复计数。

### 网页搜索开关

- 在「设置 → 插件 → 网页搜索」卡片里注入一个开关，实时控制 `web_search`。
- **开**：一切照旧（官方 DeepSeek 搜索提供方每次搜索计费）。
- **关**：从每一步的 prompt 组装中摘掉 `web_search` 工具与 `tool:web_search` 提示段，并拦下
  已经在途的调用——不会有任何请求发往搜索提供方。`web_fetch`（本地抓取）不受影响。
- 关闭时卡片整体变灰，开关本身仍可操作；写入失败会回滚并显示原因。
- 状态存在 `$DSH_HOME/websearch-toggle.json`，原子写入。

---

## 安装

需要带 `web` profile 的 DSH。

**方式一：`dsh plugin`（一行命令）**

```sh
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

`dsh plugin` 内部把命令转发给 pnpm，并在装完后自动把本包追加到 `dsh.profile.bundles`，
**不需要手工编辑任何 YAML**。（这条命令要求 `pnpm` 在 `PATH` 上。）

**方式二：npm（没有 pnpm 也可以）**

本包零依赖、也没有 lifecycle script，npm 同样能把它装进 profile，只是"自动追加 bundle 层"
这一层要手工补一行：

```sh
cd ~/.dsh/profiles/web
npm install github:mathangler/dsh-settings-extras
# 然后在本目录的 package.json 里，把 "dsh-settings-extras" 加进 dsh.profile.bundles
```

装完重启 Web 应用：

```sh
dsh web
```

然后打开 **设置**。

## 更新

**默认装法（`github:<owner>/<repo>`）**：安装时解析到的提交就写进了 lockfile，所以更新要 remove 再 add
（同样的 spec 直接再 `add` 一次、或 `update`，都不会推进到新提交）：

```sh
dsh plugin --profile web remove dsh-settings-extras
dsh plugin --profile web add github:mathangler/dsh-settings-extras
```

**一条命令更新（可选）**：安装时改用分支 ref，此后 `update` 会重新解析该分支并跟进新提交：

```sh
dsh plugin --profile web add github:mathangler/dsh-settings-extras#main
dsh plugin --profile web update dsh-settings-extras      # 以后就这一条
```

也可以直接指定提交：`dsh plugin --profile web add github:mathangler/dsh-settings-extras#<sha>`。
（用 npm 装的话同理：`npm install github:mathangler/dsh-settings-extras#<sha>`。）

## 兼容性

- DSH `0.1.5-rc.x`（实测版本）。
- 需要 **web** profile：客户端半边依赖 `slots`、`locale`、`uiWorkspace` 三个服务，web profile 都提供。
- 宿主侧的 `skills` 服务是**可选**的：缺失时只有「技能」页不出现，用量统计与网页搜索开关照常工作。
- 用量统计读会话日志，需要 `sessionQuery`（web profile 提供）；缺失时面板会显示原因而不是空白。

## 许可

MIT。
