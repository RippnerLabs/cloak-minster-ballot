import React from 'react'

export default function ResultsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Election Results</h1>
      <p className="text-muted-foreground">Analyze and view results from completed elections.</p>
      {/* This will redirect to dashboard for now */}
      <script>
        window.location.href = '/dashboard'
      </script>
    </div>
  )
} 