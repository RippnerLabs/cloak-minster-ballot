import React from 'react'

export default function ElectionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Elections</h1>
      <p className="text-muted-foreground">Detailed view of all elections in the system.</p>
      {/* This will redirect to dashboard for now */}
      <script>
        window.location.href = '/dashboard'
      </script>
    </div>
  )
} 