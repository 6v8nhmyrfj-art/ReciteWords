# ReciteWords 数据迁移与接口约定 v1

适用范围：当前 GitHub Pages 网页 + Supabase；未来网页、微信小程序、App 复用业务数据。用户在另一聊天考虑阿里云/腾讯云，但尚未选择具体目标，本次不切换数据库、不购买资源。

## 代码边界

- `backend-config.mjs`：唯一公开服务地址、publishable key、environment、contractVersion。服务密钥和数据库密码禁止写入前端。
- `class-api.mjs`：HTTP 传输及现有 Supabase 协议适配。
- `class-ui.mjs`：登录、刷新令牌、按角色加载页面。会话按 environment 隔离；现有环境旧会话自动搬到新键。
- `data-client.mjs`：账号隔离缓存、请求合并、内容版本、本机待保存作答及幂等重试。更换账号或环境不能读另一账号的缓存。
- 页面通过 `api(path,method,body)` 访问数据；此接口仍使用 PostgREST/RPC 路径。迁到自建 Supabase 兼容环境主要改配置；换成其他后端需要实现这些协议或替换适配器，并重做认证授权。不能只换数据库地址。
- `performance.sql`：第一阶段已应用的增量变更；`review-batches.sql` 是随后新增的按已复习词分批测试接口。`docs/database-baseline.json` 是变更前结构盘点（11 张业务表、函数、约束和策略），仅供核对，不能代替可恢复的数据库备份。

## 统一格式（保留现有字段，不做破坏性改名）

业务导出 JSON 顶层：`schema_version:1`、`exported_at`（UTC ISO 8601）、`counts`、`tables`。

- ID：UUID 原样保留。`rw_members.user_id` 必须继续对应认证用户 ID，不用姓名拼音充当主键。
- 时间：绝对时间使用带时区 ISO 8601；`learned_on` 使用 `YYYY-MM-DD`，业务日界线固定 Asia/Shanghai。
- 词条：`en`、`zh`；单词有 `pos`、`example`，可附 `translation`、`difficulty:1|2|3`、`test_example`、`test_translation`。短语/句子不强制词性。缺失的难度保持未分级，不伪造等级。
- 词书/任务能力：`category:reading|writing`；测评历史的 `mode` 含义相同但保持原字段。
- `words` 数组保持原顺序。任务进度及旧组测通过 `task_id + word_index` 引用；迁移时不能重排或去重该数组。若将来拆成独立词条表，先生成稳定词条 ID 和原数组位置映射，完成双读校验后再切换。
- `updated_at`：词书/任务内容版本。更新自动变化，客户端据此淘汰旧内容缓存。
- 学习作答 `p_id`、组测 `p_id`、掌握度测评 `p_test`：重试沿用同一个 ID。新端必须遵守同样的幂等约定。
- 账号邮箱/密码、认证会话与业务导出分开处理。业务 JSON 不包含密码哈希，不足以恢复原账号登录。

## 已使用的数据接口

| 用途 | 方法/接口 | 备注 |
|---|---|---|
| 词库/任务列表 | POST `rpc/rw_library_catalog` / `rpc/rw_task_catalog` | 返回 metadata + word_count + updated_at，不返回 words |
| 单本内容 | GET `rw_libraries` / `rw_tasks`，按 id 筛选 | 进入学习/编辑才取内容，依旧受 RLS 保护 |
| 学生概况 | POST `rpc/rw_student_summary` | 本周/今日统计 |
| 作答 | POST `rpc/rw_practice` | 服务端最终判题，返回 boolean；p_id 幂等 |
| 组测 | POST `rpc/rw_submit_review_batch` | 每批1至5题，全部答对才记入该批词汇进度；旧 submit_five 保留兼容 |
| 词书测评 | POST `rpc/rw_begin_mastery` / `rpc/rw_finish_mastery` | 固定测评 ID、云端结果 |
| 掌握度列表 | POST `rpc/rw_mastery_books` | 短时缓存，提交测评后失效 |
| 完成任务 | POST `rpc/rw_completed_tasks` | p_limit ≤100、p_offset，服务端聚合分页 |
| 历史/到期复习 | GET 对应业务表 | 用户筛选、时间排序、限量；禁止跨学生读写 |

小程序/App 可复用接口与字段约定，但需提供各自的网络、存储、认证刷新实现；当前浏览器 `localStorage` 模块不能直接当作小程序 SDK。

## 缓存与可靠保存

- 目录内存缓存 60 秒；学生历史、统计、书架和到期数据 30 秒；相同并发读取合并。
- 日期跨上海零点会清理缓存。写入开始及成功后清理相关读缓存；失败响应不进入读缓存。
- 单本内容最多缓存 6 本、每本序列化小于 500,000 字符、最长 5 分钟，限定当前账号/环境，比较 updated_at。成绩与作答历史不持久缓存。
- 缓存有效期意味着老师在另一设备更新后，其他学生可能短暂看到旧目录；刷新页面可重新拉取目录。开始测评及最终判分仍走服务器。
- 可幂等写入在发出前写入本机待保存列表，收到成功响应后移除；网络中断后重试原 ID。未成功的记录不显示“已保存”。学习题只有得到服务器确认才推进。
- 正式测评/组测中间答案先保存在本机，整次测评结束再提交云端。界面明确区分“本机已记录”和“云端保存”，不能当成完全离线模式。
- 显示反馈的最短时间约 180ms，与网络请求并行；正式测评错题保留约 600ms 阅读答案。词书列表的简洁界面和三项详情维持原设计。

## 导出与迁移步骤

1. 先搭建目标测试环境。选择兼容自建 Supabase 还是新后端；确定认证、PostgREST/RPC、Edge Functions、域名和 TLS 方案。
2. 配置 PostgreSQL 客户端环境变量 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSFILE`，使用有权读取完整业务数据的管理连接。密码文件权限设为 600，不把凭据放到命令行、仓库或网页。
3. 执行 `python3 tools/export-business.py --output /安全目录/recitewords-business.json`。工具通过一个只读、可重复读事务导出 11 张业务表；文件权限 600，校验行数和主要关系，已存在文件不会覆盖。
4. 执行 `python3 tools/export-business.py --validate /安全目录/recitewords-business.json` 可离线复核格式。此文件包含学生个人信息，仅保存在受控位置，禁止上传 GitHub。
5. 另按 Supabase 官方恢复流程取得数据库结构/角色/权限/函数/索引和 Auth 备份；检查 `rw-create-student` Edge Function、环境变量、创建/重置密码与认证触发器。不要手工复制会话令牌；切换后安排重新登录。保留原密码能否正常登录必须在目标环境验证。
6. 备份导入测试环境后对比每表行数、UUID、外键关系、词书顺序、学生历史与统计；以教师和两个不同学生账号验证访问隔离。验证登录→改密码→学习→断网重试→提交测试→教师查看。
7. 正式切换前暂停写入，要求各设备完成待保存队列同步；做最终一致快照并核对增量。更新 backend-config 中地址、公钥及新的 environment。不要让新旧后端同时接受独立写入。
8. 保留旧环境只读及备份。回退必须决定新环境产生的写入如何回放，不能直接切回旧库丢弃新记录。

尚未进行：真实备份导出、目标云部署、账号迁移、并发压测和国内运营商测速。本次没有把学生实际数据写入仓库，也没有修改现有账号密码。

官方参考：
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/observability/inspect

## 后续学习流程调整

- 每组最多10个实际词，仍按3/3/4顺序分段学习复习；尾组按实际数量，不加入未学基础词。
- 本组复习完的所有词分批测试，每批最多5个；尾批仅从本次学习运行中已完成复习的词补题，无足够词则按实际题量。
- 新接口仅在本批全对时记录本批实际测试的词；不会因为答对5题就将未测试的另5词标为通过。旧记录不追溯改写。
- 本机运行状态从 rw-groups-v2 迁到 v3，保留可对应的学习/复习阶段；未完成旧版抽测重新生成，新流程按批继续。
- 专注界面隐藏顶部品牌栏和底部导航，保留返回、题目及选项；常见手机尺寸正常题目不需整页滚动，超长内容保留卡片内滚动以避免遮挡。
