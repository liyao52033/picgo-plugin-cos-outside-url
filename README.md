## picgo-plugin-cos-url

A PicGo plugin for cos private resource url.

将COS的私有资源链接转成外链的PicGo插件，支持阿里云OSS、腾讯云COS、七牛云Kodo

<strong>注意：该插件没有充分测试网址后缀的场景，设置了网址后缀可能会导致非预期的结果发生</strong>

更多需求，欢迎PR或提ISSUE。

---

## 例如

过期时间设置永久：`expireSeconds=0`

过期时间设置为1个小时：`expireSeconds=3600`

开启腾讯云签名选择`开启`，否则选择`关闭`

---

## 修改配置参数后生效

![配置](https://img.xiaoying.org.cn/img/20250626222527405.png)

expireSeconds，过期秒数，默认0（永久）
sign，是否开启腾讯云签名，默认关闭

---
### 版权声明

MIT

