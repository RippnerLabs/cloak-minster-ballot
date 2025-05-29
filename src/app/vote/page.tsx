'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Dynamically import VoteUI with SSR disabled to prevent WASM loading during build
const VoteUI = dynamic(
  () => import('@/components/vote/vote-ui'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col gap-8 p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    )
  }
)

export default function VotePage() {
  return <VoteUI />
}
