# 班级客户端接入

网页、小程序和 App 共用 Supabase Auth 用户 ID。登录账号通过 loginIdentity 转成认证标识。class-api.mjs 接受平台自己的 HTTP 请求函数与令牌读取函数，供 fetch、wx.request 或原生网络层适配。密钥仅用公开客户端 key，所有权限由服务器判断。

登录后读取 auth/v1/user 和 rw_members。学生 password_changed=false 时先调用 PUT /auth/v1/user 更新密码，成功后重新读取成员。服务端触发器记录改密状态，行级权限限制未改密学生访问任务和打卡。会话采用 access_token 与可轮换的 refresh_token。各端保存会话，勿保存密码。

任务与打卡使用 rw_tasks、rw_progress。教师报表使用 rw_today，开通学生使用 rw-create-student。自主学习位置目前按本机、用户 ID 与词集保存。拼写测试成绩仅在本轮显示。
