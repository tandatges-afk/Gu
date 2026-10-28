import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {source:'/:path*',headers:[
        {key:'X-Content-Type-Options',value:'nosniff'},
        {key:'X-Frame-Options',value:'DENY'},
        {key:'Referrer-Policy',value:'no-referrer'},
        // Safe CSP directives; strict script-src requires a per-request nonce for Next hydration.
        {key:'Content-Security-Policy',value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"},
        {key:'Permissions-Policy',value:'geolocation=(), microphone=(), payment=(), camera=(self)'},
        {key:'Strict-Transport-Security',value:'max-age=31536000'},
        {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
        {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
        {key:'X-Permitted-Cross-Domain-Policies',value:'none'},
        {key:'X-DNS-Prefetch-Control',value:'off'}
      ]},
      {source:'/',headers:[{key:'Cache-Control',value:'private, no-store'}]},
      {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
      {source:'/gu-sw.js',headers:[
        {key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},
        {key:'Service-Worker-Allowed',value:'/'}
      ]}
    ];
  }
};
export default nextConfig;
