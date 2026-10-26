import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'GU – Thuê đồ xinh',description:'Quản lý cửa hàng cho thuê GU trên PostgreSQL',icons:{icon:'/favicon.svg'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#1c3829'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>;}
