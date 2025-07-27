import type { NextConfig } from 'next'
const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  // Disable static optimization for pages that use WASM
  staticPageGenerationTimeout: 120,
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
      },
      {
        source: "/api/ipfs/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/ipfs/:path*",
        destination: "https://ipfs.rippner.com/api/v0/:path*",
      },
    ];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    // Add better handling for problematic modules
    config.externals = config.externals || [];
    if (!isServer) {
      // config.externals.push({
      //   'circomlibjs': 'circomlibjs',
      //   'ffjavascript': 'ffjavascript',
      //   'snarkjs': 'snarkjs',
      // });
    }

    // Fix for WebAssembly TextDecoder/TextEncoder issues
    config.plugins.push(
      new webpack.ProvidePlugin({
        TextDecoder: ['text-encoding', 'TextDecoder'],
        TextEncoder: ['text-encoding', 'TextEncoder']
      })
    )

    // Add Node.js polyfills for client-side
    if (!isServer) {
      config.plugins.push(new NodePolyfillPlugin({
        excludeAliases: ['console']
      }))
    }

    // Optimize for client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: require.resolve('path-browserify'),
        os: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        url: require.resolve('url'),
        zlib: require.resolve('browserify-zlib'),
        buffer: require.resolve('buffer'),
        util: require.resolve('util'),
      }
    }

    // Handle WebAssembly imports properly
    config.module.rules.push({
      test: /\.js$/,
      include: [
        path.resolve(__dirname, './anchor/tests/proof_utils/pkg'),
      ],
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: [
            ['@babel/plugin-transform-runtime', {
              'regenerator': true
            }]
          ]
        }
      }
    })

    // Ignore problematic modules during build
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /Invalid asm\.js/,
      /async\/await/,
      /Failed to parse source map/,
      /the request of a dependency is an expression/,
    ];

    // Handle WebAssembly module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      'proofUtils': path.resolve(__dirname, './anchor/tests/proof_utils/pkg'),
    }

    return config
  }
}

export default nextConfig
