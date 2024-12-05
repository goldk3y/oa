import { Providers } from './components/Providers';
import NavBar from './components/NavBar';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-gray-50 dark:bg-black">
            <NavBar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
