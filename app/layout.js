import './globals.css';

export const metadata = {
  title: 'CloudSync AI Sales Bot',
  description: 'Manage AI-assisted sales calls and call history.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
