import type { Metadata, Viewport } from 'next';
import './globals.css';
import './gu-premium.css';

export const metadata: Metadata = {
  title: 'GU - Thuê đồ xinh',
  description: 'GU - Thuê đồ xinh. Quản lý kho quần áo và phụ kiện, lịch thuê, đơn hàng, khách hàng và doanh thu.',
  applicationName: 'GU',
  icons: { icon: '/favicon.svg', apple: '/icons/gu-192.png' },
  appleWebApp: { capable: true, title: 'GU', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  // Internal admin workspace: do not expose the login screen through search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: {index: false, follow: false, noimageindex: true} },
};

export const viewport: Viewport = {
  themeColor: '#183d4b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
