import React from 'react'

export default function ReceiptPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vote Receipt</h1>
      <p className="text-muted-foreground">View your voting confirmation and transaction details.</p>
      {/* This will redirect to vote page for now */}
      <script>
        window.location.href = '/vote'
      </script>
    </div>
  )
} 