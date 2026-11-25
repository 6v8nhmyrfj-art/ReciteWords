# 腾讯云网站部署包

这套工具仅发布静态前端，不迁移数据库或认证。当前暂存包故意指向 api.invalid，防止新网站误向旧生产库写入。没有正式启用。

构建：
```
python3 deploy/tencent/build.py --config deploy/tencent/staging-config.json --output outputs/web-release-20261125
```
真实配置另存权限受控文件，字段baseUrl为HTTPS API、publishableKey为公开客户端key、environment为新环境唯一ID。禁止service_role/secret key。配置就绪后重新构建，不手改包内文件。

产物：website.tar.gz、manifest.json、site/。仅根目录HTML/MJS/CSS；排除数据库备份、server、SQL、docs、账号名单和密钥。

服务器：/opt/recitewords-web/releases/<版本>/，上传后解压；通过manifest校验每个文件SHA256。
Nginx模板需替换真实域名和证书路径；与现有IP测试入口并存，不覆盖默认站点。首次只在127.0.0.1:8088提供待测包，通过SSH隧道检查。

正式发布前：
1. 域名A记录指向129.204.40.183，完成适用备案要求；云防火墙80/443放行，HTTPS可信。
2. 数据库恢复及账号原密码、权限、重置密码、任务和口头抽查验证完成。
3. 三个业务Edge Functions的CORS允许新域名；中文、英文语音和语义判分服务凭据在服务端。
4. 手机浏览器测试录音、登录保持、缓存隔离；不得以只显示登录页作为完整上线验收。
5. 使用真实配置重建、上传、验签；切换窗口停止旧端写入并完成最终同步。
6. 执行python3 activate.py <版本>，原子切换current软链接；nginx -t后再启用域名配置。

回滚静态页面：对旧版本再次执行activate.py。只回滚静态文件不能撤销数据库迁移；新库已有写入时必须先核对增量，禁止直接切回旧库。

尚待：域名、源数据库完整备份连接、目标后端恢复和国内语音服务配置。现有生产入口不变。

## 2026-11-25 实际状态

参见 `docs/TENCENT-CUTOVER-20261125.md`。后端恢复与验收完成，但域名受到腾讯云备案阻断，已安全回退，旧站仍是唯一生产写入端。此前的“尚待域名/源库连接”段落为准备阶段记录，不代表最新状态。

`prepare-backend.py --output <受保护的新目录>` 可生成固定版本后端配置和随机密钥；拒绝覆盖已有目录。部署目录必须限制为所有者可读，填写 `functions.env` 后运行 Docker Compose。不提供公开 Studio 管理端。生产中应记录镜像摘要，更新需重新验收。

`migration/` 保存本次实际使用的核对与恢复步骤，针对受控服务器目录。不得直接在生产执行冻结脚本；须先确认备案与公网访问、目标恢复演练、回滚条件均满足。冻结以后任何异常都需先核对目标增量再回退，不能直接解冻造成双写。

`backup.sh` 与两个 systemd 文件负责本机每日备份，定时器使用 UTC 19:00（北京时间次日03:00）。异机备份和恢复演练仍需另行安排。
