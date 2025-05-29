import React from 'react'

interface ElectionDetailPageProps {
  params: {
    name: string
  }
}

export default function ElectionDetailPage({ params }: ElectionDetailPageProps) {
  const electionName = decodeURIComponent(params.name)
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Election Details: {electionName}</h1>
      <p className="text-muted-foreground">Detailed information about the {electionName} election.</p>
      {/* This will redirect to dashboard for now */}
      <script>
        window.location.href = '/dashboard'
      </script>
    </div>
  )
} 