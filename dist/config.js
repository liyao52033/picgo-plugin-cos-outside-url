"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Processors = exports.QiniuProcessor = exports.TencentProcessor = exports.AliyunProcessor = void 0;
const qiniu_1 = __importDefault(require("qiniu"));
const ali_oss_1 = __importDefault(require("ali-oss"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const COS = require('cos-nodejs-sdk-v5');
class AliyunProcessor {
    constructor() {
        this.key = 'aliyun';
        this.name = '阿里云';
    }
    process(ctx, img, expireSeconds) {
        var _a;
        const config = ctx.getConfig('picBed.aliyun');
        const store = new ali_oss_1.default({
            region: config.area,
            accessKeyId: config.accessKeyId,
            accessKeySecret: config.accessKeySecret,
            bucket: config.bucket
        });
        const key = (config.path ? config.path : '') + img.fileName;
        // 去掉问号
        let process = ((_a = config.options) === null || _a === void 0 ? void 0 : _a.startsWith('?')) ? config.options.substring(1) : config.options;
        // 去掉x-oss-process=
        process = process.replace('x-oss-process=', '');
        let url = store.signatureUrl(key, {
            process,
            expires: expireSeconds
        });
        // 取消URI转义，避免多次转义，导致复制到粘贴板的地址不正确
        url = decodeURIComponent(url);
        if (config.customUrl) {
            const prefix = config.customUrl.endsWith('/') ? config.customUrl : config.customUrl + '/';
            url = `${prefix}${url.substring(url.indexOf(key))}`;
        }
        return url;
    }
}
exports.AliyunProcessor = AliyunProcessor;
class TencentProcessor {
    constructor() {
        this.key = 'tcyun';
        this.name = '腾讯云COS';
    }
    process(ctx, img, expireSeconds) {
        var _a;
        const config = ctx.getConfig('picBed.tcyun');
        const cos = new COS({
            SecretId: config.secretId,
            SecretKey: config.secretKey,
            // 是否自定义域名
            Domain: config.customUrl ? config.customUrl : ''
        });
        const key = (config.path ? config.path : '') + img.fileName;
        // 去掉问号
        const queryStr = ((_a = config.path) === null || _a === void 0 ? void 0 : _a.startsWith('?')) ? config.path.substring(1) : config.path;
        const query = new Map(queryStr.split('&').map(value => {
            const arr = value.split('=');
            return [arr[0], arr];
        }));
        let url = cos.getObjectUrl({
            Bucket: config.bucket,
            Region: config.area,
            Key: key,
            Sign: true,
            Query: query,
            Expires: expireSeconds
        }, (err, data) => {
            if (err) {
                ctx.log.warn(err.message);
            }
            url = data.Url;
        });
        return url;
    }
}
exports.TencentProcessor = TencentProcessor;
class QiniuProcessor {
    constructor() {
        this.key = 'qiniu';
        this.name = '七牛云Kodo';
    }
    process(ctx, img, expireSeconds) {
        const config = ctx.getConfig('picBed.qiniu');
        const key = (config.path ? config.path : '') + img.fileName;
        const mac = new qiniu_1.default.auth.digest.Mac(config.accessKey, config.secretKey);
        const bucketManager = new qiniu_1.default.rs.BucketManager(mac, new qiniu_1.default.conf.Config());
        const deadline = parseInt(String(Date.now() / 1000)) + expireSeconds;
        return bucketManager.privateDownloadUrl(config.url, key, deadline);
    }
}
exports.QiniuProcessor = QiniuProcessor;
class Processors {
    constructor() {
        this.values = [
            new AliyunProcessor(),
            new TencentProcessor(),
            new QiniuProcessor()
        ];
    }
    select(key) {
        return this.values.find(value => value.key === key);
    }
}
exports.Processors = Processors;
