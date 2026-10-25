import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transformers.js CLIP runs in the browser. Never bundle native Node ONNX into the client.
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
      'sharp$': false,
    };
    return config;
  },
  async headers() {
    return [
      {source:'/:path*',headers:[
        {key:'X-Content-Type-Options',value:'nosniff'},
        {key:'X-Frame-Options',value:'DENY'},
        {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
        {key:'Permissions-Policy',value:'geolocation=(), microphone=(), payment=()'}
      ]},
      {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
      {source:'/gu-sw.js',headers:[
        {key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},
        {key:'Service-Worker-Allowed',value:'/'}
      ]}
    ];
  }
};
export default nextConfig;
