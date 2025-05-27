'use client'

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletStatus } from "../ui/wallet-status"
import { SidebarUI } from "../sidebar/sidebar-ui"

function MainContent() {
  return <></>
}

export default function VoteUI() {
  const { publicKey } = useWallet()

  if (!publicKey) {
    return (
      <WalletStatus />
    )
  }

  return (
    <SidebarUI>
      <MainContent />
    </SidebarUI>
  )
}