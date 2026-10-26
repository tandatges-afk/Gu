import type { NextConfig } from 'next';
const config:NextConfig={reactStrictMode:true,turbopack:{root:process.cwd()},async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'},{key:'Content-Security-Policy',value:"frame-ancestors 'none'"}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private,no-store'}]}];}};
export default config;
