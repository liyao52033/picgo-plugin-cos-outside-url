"use strict";
const config_1 = require("./config");
const processors = new config_1.Processors();
const handle = (ctx) => {
    let expireSeconds = ctx.getConfig('picgo-plugin-oss-outside-url.expireSeconds') || 0;
    expireSeconds = parseInt(String(expireSeconds));
    if (expireSeconds <= 0) {
        expireSeconds = 9000000000 - parseInt(String(Date.now() / 1000));
    }
    ctx.log.info(`OSS外链: expireSeconds=${expireSeconds}秒`);
    const uploaderKey = ctx.getConfig('picBed.current');
    const processor = processors.select(uploaderKey);
    if (!processor) {
        const items = ctx.getConfig('picBed.list') || [];
        const item = items.find(v => v.type === uploaderKey);
        ctx.emit('notification', {
            title: 'OSS外链',
            body: `不支持OSS ${uploaderKey}=${item === null || item === void 0 ? void 0 : item.name}，跳过外链处理`,
            text: ''
        });
        return;
    }
    ctx.log.info(`OSS外链: 匹配到处理程序: ${processor.key}=${processor.name}`);
    ctx.output.forEach(img => {
        ctx.log.info(`OSS外链: fileName=${img.fileName}`);
        ctx.log.info(`OSS外链: originUrl=${img.imgUrl}`);
        img.imgUrl = processor.process(ctx, img, expireSeconds);
        ctx.log.info(`OSS外链: outsideUrl=${img.imgUrl}`);
    });
};
const config = (ctx) => {
    const userConfig = ctx.getConfig('picgo-plugin-oss-outside-url') ||
        {
            expireSeconds: 0
        };
    return [
        {
            name: 'expireSeconds',
            type: 'input',
            alias: '过期时间(秒)',
            default: userConfig.expireSeconds || 0,
            message: '0表示永久',
            required: true
        }
    ];
};
module.exports = (ctx) => {
    const register = () => {
        ctx.helper.afterUploadPlugins.register('oss-outside-url', {
            handle,
            name: 'OSS外链',
            config
        });
    };
    return {
        register,
        config
    };
};
