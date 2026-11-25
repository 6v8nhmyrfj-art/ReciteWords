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
