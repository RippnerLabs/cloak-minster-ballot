import { Metadata } from 'next'
import ElectionViewUI from '@/components/election-view/election-view-ui'

export const metadata: Metadata = {
  title: 'Election Details - ZK Voting System',
  description: 'View detailed information about a specific election including status, options, and results.',
}

export default function ElectionDetailPage() {
  return (
    <ElectionViewUI />
  )
} 