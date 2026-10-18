import { describe, expect, test } from 'bun:test'
import { BUILTIN_OTHER_ID, CategoryIndex, builtinDefaults } from './categories'
import type { CustomCategoryDto } from '../../../lib/rpc'
import { extensionOf, urlExtensionOf } from './task'
import type { DownloadTaskView } from './task'

/** 仅填分类匹配关心的字段；`categoryExtension` 按真实建行逻辑预计算。 */
const makeView = (name: string, url: string): DownloadTaskView =>
  ({ name, url, categoryExtension: extensionOf(name) ?? urlExtensionOf(url) }) as DownloadTaskView

describe('urlExtensionOf', () => {
  test('取路径末段扩展名，查询串不参与，结果小写', () => {
    expect(urlExtensionOf('https://x.test/a/My%20Song.flac?sig=1')).toBe('flac')
    expect(urlExtensionOf('https://x.test/files/Video.MP4')).toBe('mp4')
  })

  test('末段无扩展 / 尾斜杠 / 非 URL / 无路径的伪协议都返回 null', () => {
    expect(urlExtensionOf('https://x.test/download')).toBeNull()
    expect(urlExtensionOf('https://x.test/a/')).toBeNull()
    expect(urlExtensionOf('')).toBeNull()
    expect(urlExtensionOf('not a url')).toBeNull()
    expect(urlExtensionOf('magnet:?xt=urn:btih:0123456789abcdef')).toBeNull()
  })

  test('非法百分号序列保留原样，仍能取到扩展名', () => {
    expect(urlExtensionOf('https://x.test/a%zz.mp4')).toBe('mp4')
  })
})

describe('分类扩展名的 URL 兜底', () => {
  const index = new CategoryIndex(builtinDefaults())

  test('空文件名 + m3u8/ts URL 命中视频分类（浏览器捕获场景）', () => {
    expect(index.categoryOf(makeView('', 'https://v.test/hls/master.m3u8?token=x'))).toBe('builtin_video')
    expect(index.categoryOf(makeView('', 'https://v.test/seg0001.ts'))).toBe('builtin_video')
  })

  test('URL 末段百分号解码后参与匹配', () => {
    expect(index.categoryOf(makeView('', 'https://x.test/a/My%20Song.flac'))).toBe('builtin_audio')
    expect(index.categoryOf(makeView('', 'https://x.test/p/Ubuntu%2024.04.iso'))).toBe('builtin_archive')
  })

  test('文件名有扩展名时优先于 URL，不受干扰', () => {
    expect(index.categoryOf(makeView('setup.exe', 'https://x.test/latest/player.mp4'))).toBe('builtin_program')
  })

  test('空文件名 + 无扩展 URL 落「其他」；「全部」恒真', () => {
    const view = makeView('', 'https://x.test/download?id=7')
    expect(index.categoryOf(view)).toBe(BUILTIN_OTHER_ID)
    expect(index.matches('builtin_all', view)).toBe(true)
    expect(index.matches(BUILTIN_OTHER_ID, view)).toBe(true)
  })
})

describe('正则分类不吃 URL 兜底', () => {
  const regexCategory: CustomCategoryDto = {
    id: 'named-video',
    name: 'video-*',
    icon: 'film',
    matchMode: 'regex',
    extensions: [],
    regexPattern: '^video-',
    position: 0,
    visible: true,
    isBuiltin: false,
    builtinType: null,
    saveDir: '',
  }
  const index = new CategoryIndex([...builtinDefaults(), regexCategory])

  test('正则按显示名匹配；空名任务即使 URL 像视频也不被正则吸收', () => {
    expect(index.categoryOf(makeView('video-abc', 'https://x.test/1'))).toBe('named-video')
    expect(index.categoryOf(makeView('', 'https://x.test/player.mp4'))).toBe('builtin_video')
  })
})
