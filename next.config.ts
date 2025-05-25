import type { NextConfig } from 'next'
const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const nextConfig: NextConfig = {
  compiler: {
    
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    // Provide TextDecoder and TextEncoder for WASM modules
    config.plugins.push(
      new webpack.ProvidePlugin({
        TextDecoder: ['text-encoder', 'TextDecoder'],
        TextEncoder: ['text-encoder', 'TextEncoder']
      })
    )

    // Optimize for client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      }
    }

    return config
  }
}

export default nextConfig
