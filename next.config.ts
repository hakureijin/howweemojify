import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { resolveBasePath } from './lib/base-path'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const basePath = resolveBasePath(process.env.GITHUB_PAGES)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default withNextIntl(nextConfig)
