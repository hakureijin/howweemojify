export type Locale = 'zh' | 'en'

/** 根路径跳转目标。trailingSlash: true，故必须带尾斜杠。 */
export function redirectHref(base: string, locale: Locale): string {
  return `${base}/${locale}/`
}

/**
 * 根页面的内联脚本。静态托管上没有 middleware，语言协商只能放到客户端。
 * navigator/location 由参数注入，便于测试直接执行本脚本。
 */
export function redirectScript(base: string): string {
  const b = JSON.stringify(base)
  return `(function(n,l){var t=(n.language||'').toLowerCase().indexOf('en')===0?'en':'zh';l.replace(${b}+'/'+t+'/');})(navigator,location);`
}
