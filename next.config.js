const isDev = process.env.NODE_ENV === 'development';

// Only load PWA plugin in production to speed up dev compilation
const withPWA = isDev 
  ? (config) => config // Skip PWA processing in dev
  : require('next-pwa')({
      dest: 'public',
      register: false,
      skipWaiting: true,
      runtimeCaching: [
        // CSS, Fonts, and Static Assets (CacheFirst strategy)
        {
          urlPattern: /\.(?:css|woff2|jpg|jpeg|png|svg|webp|gif|ico)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        // JavaScript and JSON files (StaleWhileRevalidate strategy)
        {
          urlPattern: /\.(?:js|json)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'js-resources',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            },
          },
        },
        // API calls (NetworkFirst strategy with shorter timeout)
        {
          urlPattern: /\/api\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10, // Timeout after 10 seconds
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
          },
        },
        // Everything else (NetworkFirst as fallback)
        {
          urlPattern: /^https?.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'fallback-cache',
            expiration: {
              maxEntries: 100,
            },
            networkTimeoutSeconds: 15,
          },
        },
      ],
    });

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip type checking during build for faster compilation
    ignoreBuildErrors: false,
    // Faster type checking in dev
    tsconfigPath: './tsconfig.json',
  },
  images: { unoptimized: true },
  // Optimize for performance
  reactStrictMode: true,
  swcMinify: true,
  // Faster compilation settings - only include compiler options in production
  // (Turbopack doesn't support compiler options in dev mode)
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: true,
    },
  }),
  // Optimize for mobile
  experimental: {
    // Disable CSS optimization in dev for faster compilation
    optimizeCss: !isDev,
    scrollRestoration: true,
    // Faster refresh and package imports
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },
  // Netlify specific configuration
  output: isDev ? undefined : 'standalone', // Only use standalone in production
  // Faster compilation in dev
  webpack: (config, { dev }) => {
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    
    return config;
  },
};

module.exports = withPWA(nextConfig);
