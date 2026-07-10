/**
 * GitHub Pages 项目站点的子路径。整个代码库中这个字面量只应出现在这里。
 */
export const PAGES_BASE_PATH = '/howweemojify'

/** 构建期：由 next.config.ts 调用，决定 Next 的 basePath。 */
export function resolveBasePath(githubPages: string | undefined): string {
  return githubPages === 'true' ? PAGES_BASE_PATH : ''
}

/**
 * 运行期：给不经 Next 路由的绝对路径（public/ 下的静态资源）加前缀。
 * Next 不改写手写的绝对路径，凡是指向 public/ 的 fetch/src/href 都要过这里。
 */
export function withBasePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`
}
