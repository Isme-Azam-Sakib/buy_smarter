/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['www.techlandbd.com', 'www.skyland.com.bd', 'www.startech.com.bd', 'www.ryans.com', 'www.pchouse.com.bd', 'www.ultratech.com.bd'],
  },
  async rewrites() {
    return [
      {
        source: '/api/scraper/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ]
  },
}

module.exports = nextConfig
