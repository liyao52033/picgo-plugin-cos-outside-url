import { PicGo } from 'picgo'
import { IPluginConfig, ITcyunConfig } from 'picgo/dist/utils/interfaces'
import { IImgInfo } from 'picgo/dist/types'
import { Config, ListItem, Processors, getCosPutObjectParams, getBodyFromImage } from './config'

const processors = new Processors()

const handle = (ctx: PicGo): void => {
  let expireSeconds = ctx.getConfig<number>('picgo-plugin-cos-url.expireSeconds') || 0
  let sign = ctx.getConfig<boolean>('picgo-plugin-cos-url.sign') || false
  expireSeconds = parseInt(String(expireSeconds))
  if (expireSeconds <= 0) {
    expireSeconds = 9_000_000_000 - parseInt(String(Date.now() / 1000))
  } else {
    ctx.log.info(`OSS外链: expireSeconds=${expireSeconds}秒`)
  }
  
  const uploaderKey = ctx.getConfig<string>('picBed.current')
  const processor = processors.select(
    uploaderKey === 'cos-upload' ? 'tcyun' : uploaderKey
  )
  if (!processor) {
    const items = ctx.getConfig<ListItem[]>('picBed.list') || []
    const item = items.find(v => v.type === uploaderKey)
    ctx.emit('notification', {
      title: 'OSS外链',
      body: `不支持OSS ${uploaderKey}=${item?.name}，跳过外链处理`,
      text: ''
    })
    return
  }
  ctx.log.info(`OSS外链: 匹配到处理程序: ${processor.key}=${processor.name}`)
  ctx.output.forEach(img => {
    ctx.log.info(`OSS外链: fileName=${img.fileName}`)
    ctx.log.info(`OSS外链: originUrl=${img.imgUrl}`)
    img.imgUrl = processor.process(ctx, img, expireSeconds, sign)
    ctx.log.info(`OSS外链: outsideUrl=${img.imgUrl}`)
  })
}

const config = (ctx: PicGo): IPluginConfig[] => {
  const userConfig = ctx.getConfig<Config>('picgo-plugin-cos-url') ||
  {
    expireSeconds: 0,
    sign: false
  }
  return [
    {
      name: 'expireSeconds',
      type: 'input',
      alias: '过期时间(秒)',
      default: userConfig.expireSeconds || 0,
      message: '0表示永久',
      required: true
    },
    {
      name: 'sign',
      type: 'confirm',
      alias: '生成腾讯云签名',
      default: userConfig.sign ?? false,
      message: '开启后上传到腾讯云的图片带签名链接',
      required: true
    }
  ]
}

const customAfterUpload = async (ctx: PicGo): Promise<void> => {
  const config = ctx.getConfig<ITcyunConfig>('picBed.tcyun')
  if (!config) {
    ctx.log.warn('未找到腾讯云COS配置, 跳过自定义上传')
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const COS = require('cos-nodejs-sdk-v5')
  const cos = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
    Domain: config.customUrl ?? ''
  })
  let sign = ctx.getConfig<boolean>('picgo-plugin-cos-url.sign') || false
  let expireSeconds = ctx.getConfig<number>('picgo-plugin-cos-url.expireSeconds') || 0
  expireSeconds = parseInt(String(expireSeconds))
  if (expireSeconds <= 0) {
    expireSeconds = 9_000_000_000 - parseInt(String(Date.now() / 1000))
  }
  for (const img of ctx.output) {
    try {
      const putParams = getCosPutObjectParams(ctx, img, sign, expireSeconds)
      const body = getBodyFromImage(img, ctx)
      if (!body) {
        ctx.log.warn(`跳过上传, 未获取到图片内容: ${img.fileName}`)
        continue
      }
      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: putParams.Bucket,
          Region: putParams.Region,
          Key: putParams.Key,
          Body: body,
          ContentDisposition: 'attachment'
        }
          , (err: any, data: any) => {
            if (err) {
              ctx.log.warn('COS putObject 上传失败: ' + err.message)
              ctx.emit('notification', {
                title: 'COS上传失败',
                body: err.message || String(err),
                text: ''
              })
              reject(err)
            } else {
              // 合并外链处理逻辑
              if (data && data.Location) {
                img.imgUrl = 'https://' + data.Location
              }
              handle(ctx)
              resolve(data)
            }
          })
      })
    } catch (e: any) {
      ctx.log.warn('COS putObject 异常: ' + (e && e.message ? e.message : String(e)))
    }
  }
}

// 删除腾讯云COS图片
async function deleteCosImage(ctx: PicGo, img: IImgInfo | IImgInfo[]) {
  const imgs = Array.isArray(img) ? img : [img]
  try {
    const config = ctx.getConfig<ITcyunConfig>('picBed.tcyun')
    if (!config) return
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const COS = require('cos-nodejs-sdk-v5')
    const cos = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
      Domain: config.customUrl ?? ''
    })
    for (const item of imgs) {
      let key = (config.path ?? '') + item.fileName
      await new Promise((resolve, reject) => {
        cos.deleteObject({
          Bucket: config.bucket,
          Region: config.area,
          Key: key
        }, (err: any, data: any) => {
          if (err) {
            ctx.log.warn('COS deleteObject 删除失败: ' + err.message)
            reject(err)
          } else {
            ctx.log.info('COS deleteObject 删除成功: ' + key)
            resolve(data)
          }
        })
      })
    }
  } catch (e: any) {
    ctx.log.warn('COS deleteObject 异常: ' + (e && e.message ? e.message : String(e)))
  }
}

export = (ctx: PicGo) => {
  const register = (): void => {
    ctx.helper.uploader.register('cos-upload', {
      handle: customAfterUpload,
      name: 'COS自定义上传',
    })

    // 监听 PicGo 删除图片事件
    ctx.on('remove', async (img: any) => {
      await deleteCosImage(ctx, img)
    })

    // if (!ctx.helper.afterUploadPlugins.get('oss-outside-url')) {
    //   ctx.helper.afterUploadPlugins.register('oss-outside-url', {
    //     handle,
    //     name: 'OSS外链',
    //     config
    //   })
    // }
  }
  return {
    register,
    config
  }
}
