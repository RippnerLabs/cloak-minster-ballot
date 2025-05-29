import React from 'react'

export default function VotersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Voter Management</h1>
      <p className="text-muted-foreground">Manage registered voters and their verification status.</p>
      {/* This will redirect to dashboard for now */}
      <script>
        window.location.href = '/dashboard'
      </script>
    </div>
  )
} 