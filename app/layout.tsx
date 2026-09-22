import type { Metadata } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import { Sidebar } from '@/components/shell/sidebar';
import './globals.css';

export const dynamic = 'force-dynamic';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const display = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'json-render playground',
  description: 'Hands-on labs for json-render: specs, catalogs, state, streaming and AI generation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme before paint, so a dark-mode reload never flashes white. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('jr-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`,
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <Sidebar hasKey={hasKey} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
