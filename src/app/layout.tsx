import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GU - Thuê đồ xinh',
  description: 'GU - Thuê đồ xinh. Quản lý kho quần áo và phụ kiện, lịch thuê, đơn hàng, khách hàng và doanh thu.',
  applicationName: 'GU',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
