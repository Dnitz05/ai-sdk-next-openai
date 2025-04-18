import './globals.css';
import { Inter } from 'next/font/google';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import supabase from '@/lib/supabase/client';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AI SDK - Next.js OpenAI Examples',
  description: 'Examples of using the AI SDK with Next.js and OpenAI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body className={inter.className}>
        <SessionContextProvider supabaseClient={supabase}>
          {children}
        </SessionContextProvider>
      </body>
    </html>
  );
}
