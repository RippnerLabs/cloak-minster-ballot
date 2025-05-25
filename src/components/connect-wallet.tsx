import { Zap } from "lucide-react";
import { SidebarUI } from "./sidebar/sidebar-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { WalletButton } from "./solana/solana-provider";

export function ConnectWallet() {
  return (
    <SidebarUI>
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Card className="w-full max-w-md p-8 text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Zap className="w-6 h-6" />
              Connect Wallet
            </CardTitle>
            <CardDescription>
              Connect your Solana wallet to access the ZK Voting Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    </SidebarUI>

  )
}
