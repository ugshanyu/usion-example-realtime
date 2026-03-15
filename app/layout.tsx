export const metadata = {
  title: 'Tag Arena',
  description: 'Real-time multiplayer tag game on Usion',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
