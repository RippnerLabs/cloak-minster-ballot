'use client';

import '../../../app/globals.css'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { ReactQueryProvider } from '@/components/react-query-provider';
import { SolanaProvider } from '@/components/solana/solana-provider'

// import { ThemeProvider } from 'next-themes';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
      {/* <ThemeProvider attribute="class" defaultTheme="system" enableSystem> */}
        <ReactQueryProvider>
          <ClusterProvider>
            <SolanaProvider>
                {children}
            </SolanaProvider>
          </ClusterProvider>
        </ReactQueryProvider>
        {/* </ThemeProvider> */}
        </body>
    </html>
  );
}
