# GitHub 前端 / 腾讯云后端备用站

2026-11-27：正式站 `sheng-vocab/` 继续连接 Supabase；独立 `tencent-test/`
连接 `https://129.204.40.183`。未恢复暂停的域名解析。

## 数据边界

本次源库快照：2026-11-27 15:17（北京时间）。23 张账号/业务表逐行摘要
核对一致，账号 UUID、密码哈希与源库一致。源库未冻结，旧站继续可写。
备用站是独立快照，测试产生的数据不会同步回正式站，也不承诺后续实时一致。
最终切换前必须保存测试库备份，再用最新正式数据做最终同步。

源快照保存在主机受限目录：
`/home/ubuntu/recitewords-backups/test-20261127T071726Z.dump`
SHA256：`5b05c0572cec5c0a83787bd9c3740e762bd704da0adfa229c8756750098e3638`。
原测试库另已备份。备份、密码、服务端密钥不能提交 GitHub。

## 可迁移的构建方式

`deploy/tencent/build.py --config <私有配置.json> --output <新发布目录>`
生成相同业务代码的独立静态站和 SHA256 清单。配置：

- `baseUrl`：后端 HTTPS 地址。测试为 IP，正式可换成已备案域名。
- `publishableKey`：目标后端公开 anon key，严禁 service_role key。
- `environment`：后端环境标识。此次 `tencent-test-20261127`，用于隔离登录及缓存。
- `deploymentLabel`：可选测试提示；正式构建去掉此项。

所有页面与模块使用相对路径，可部署 GitHub 子目录或自有域名根目录。
测试目录是构建产物；更新功能应修改源代码并重新构建，不直接单独维护两套业务代码。
不应将测试配置覆盖到现有 `sheng-vocab/backend-config.mjs`。

## 备案后切换

1. 确认备案、DNS、可信 HTTPS；修改 Nginx 配置前先备份并执行 `nginx -t`。
2. 后端统一修改 `API_EXTERNAL_URL`、`GOTRUE_SITE_URL`、
   `GOTRUE_URI_ALLOW_LIST`，Edge Functions 的 `ALLOWED_ORIGINS` 保留所需来源。
   当前测试登录源是 `https://6v8nhmyrfj-art.github.io/ReciteWords/tencent-test/`。
3. 使用自有域名的 API 配置重新构建、校验、发布静态文件。移除测试提示。
4. 安排正式切换窗口：备份、暂停旧端写入、最终一致性同步、检查权限和密码哈希。
   本次测试快照不能直接作为未来正式数据。不要同时开放两套数据库给学生正式打卡。
5. 验证真实登录、教师周进度、词书、作答保存、语音、会话续期后再启用正式入口。
   旧站转为明确跳转或只读，避免双写。新域名首次需要重新登录，账号密码保留。
6. 新库已产生正式写入后不得直接回切旧库；先保存并核对新数据。

## 运维

服务位于 `/home/ubuntu/recitewords-selfhost/config`；数据库不开放公网端口。
IP 测试 API 仅代理 `/auth/v1/`、`/rest/v1/`、`/functions/v1/`。
IP 证书为短期证书，须保持既有续期任务和 ACME 验证通路正常。
自有域名启用后也必须保留证书自动续期。每日数据库备份任务保留。
语音仍使用现有云端识别；Vosk/Whisper 离线实验没有自动接替正式接口。
