import { resolveBasePath } from '@/lib/base-path'
import { redirectHref, redirectScript } from '@/lib/locale-redirect'

// 构建期求值：静态托管上没有 middleware，根路径的语言协商改由本页在客户端完成。
const base = resolveBasePath(process.env.GITHUB_PAGES)

export default function RootRedirect() {
  return (
    <html lang="zh">
      <head>
        <meta httpEquiv="refresh" content={`0;url=${redirectHref(base, 'zh')}`} />
        <script dangerouslySetInnerHTML={{ __html: redirectScript(base) }} />
      </head>
      <body />
    </html>
  )
}
