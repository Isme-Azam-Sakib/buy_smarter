/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['www.techlandbd.com', 'www.skyland.com.bd', 'www.startech.com.bd', 'www.ryans.com', 'www.pchouse.com.bd', 'www.ultratech.com.bd'],
  },
  experimental: {
    serverComponentsExternalPackages: ['sqlite3'],
  },
}

module.exports = nextConfig
