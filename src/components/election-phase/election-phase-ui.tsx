'use client'

import React, { useState } from 'react'
import { SidebarUI } from "../sidebar/sidebar-ui"
import { useElectionPhaseManager, ElectionPhase } from './election-phase-data-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { BackgroundGradient } from '@/components/ui/background-gradient'
import { Spotlight } from '@/components/ui/spotlight'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { useRouter } from 'next/navigation'
import { 
  Settings,
  Clock,
  Vote,
  CheckCircle,
  XCircle,
  Play,
  AlertTriangle,
  Crown,
  Activity,
  BarChart3,
  TrendingUp,
  ArrowRight,
  Zap,
  Timer
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function ElectionStatusBadge({ election }: { election: ElectionPhase }) {
  const status = election.isRegistrationOpen 
    ? 'registration' 
    : election.isVotingOpen 
      ? 'voting' 
      : 'ended'

  const badgeConfig = {
    registration: { 
      variant: 'default' as const, 
      className: 'bg-blue-500 hover:bg-blue-600',
      icon: Clock,
      label: 'Registration Open'
    },
    voting: { 
      variant: 'default' as const, 
      className: 'bg-green-500 hover:bg-green-600',
      icon: Vote,
      label: 'Voting Open'
    },
    ended: { 
      variant: 'outline' as const, 
      className: 'border-gray-500 text-gray-500',
      icon: CheckCircle,
      label: 'Ended'
    }
  }

  const config = badgeConfig[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn("flex items-center gap-1", config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function ElectionStatsCard({ election }: { election: ElectionPhase }) {
  const { getElectionStats } = useElectionPhaseManager()
  const stats = getElectionStats(election)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalVotes}</div>
          <p className="text-xs text-muted-foreground">
            Across all options
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Options</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalOptions}</div>
          <p className="text-xs text-muted-foreground">
            Available choices
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Leading Option</CardTitle>
          <Crown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold truncate">
            {stats.leadingOption || 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            Most votes
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PhaseControlPanel({ election }: { election: ElectionPhase }) {
  const { closeRegistration, concludeElection, canTransitionPhase } = useElectionPhaseManager()
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isConcludeDialogOpen, setIsConcludeDialogOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()

  const canCloseRegistration = canTransitionPhase(election, 'voting')
  const canConcludeElection = canTransitionPhase(election, 'ended')
  const isRegistrationOpen = election.isRegistrationOpen
  const isVotingOpen = election.isVotingOpen
  const isElectionEnded = !isRegistrationOpen && !isVotingOpen

  const handleCloseRegistration = async () => {
    setIsTransitioning(true)
    try {
      await closeRegistration.mutateAsync(election.name)
      setIsConfirmDialogOpen(false)
      toast.success('Phase transition completed successfully!')
      router.push(`/voucher?election=${encodeURIComponent(election.name)}`)
    } catch (error) {
      console.error('Failed to transition phase:', error)
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleConcludeElection = async () => {
    setIsTransitioning(true)
    try {
      await concludeElection.mutateAsync(election.name)
      setIsConcludeDialogOpen(false)
    } catch (error) {
      console.error('Failed to conclude election:', error)
    } finally {
      setIsTransitioning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Phase Control
        </CardTitle>
        <CardDescription>
          Manage the current phase of your election
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">Current Phase</p>
            <ElectionStatusBadge election={election} />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className={cn("w-5 h-5", isRegistrationOpen ? "text-blue-500" : "text-gray-400")} />
              <div>
                <p className="font-medium">Registration Phase</p>
                <p className="text-sm text-muted-foreground">Voters can register and submit proofs</p>
              </div>
            </div>
            {isRegistrationOpen ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Vote className={cn("w-5 h-5", isVotingOpen ? "text-green-500" : "text-gray-400")} />
              <div>
                <p className="font-medium">Voting Phase</p>
                <p className="text-sm text-muted-foreground">Registered voters can cast their ballots</p>
              </div>
            </div>
            {isVotingOpen ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className={cn("w-5 h-5", isElectionEnded ? "text-purple-500" : "text-gray-400")} />
              <div>
                <p className="font-medium">Election Concluded</p>
                <p className="text-sm text-muted-foreground">Final results are available</p>
              </div>
            </div>
            {isElectionEnded ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        <Separator />

        {/* Close Registration Button */}
        {canCloseRegistration && (
          <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" disabled={closeRegistration.isPending}>
                <Play className="w-4 h-4 mr-2" />
                Close Registration & Open Voting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Confirm Phase Transition
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to close registration and open voting for &quot;{election.name}&quot;?
                  <br /><br />
                  <strong>This action cannot be undone.</strong> Once voting begins, no new voters can register.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsConfirmDialogOpen(false)}
                  disabled={isTransitioning}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCloseRegistration} 
                  disabled={isTransitioning}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isTransitioning ? (
                    <>
                      <Timer className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Confirm Transition
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Conclude Election Button */}
        {canConcludeElection && (
          <Dialog open={isConcludeDialogOpen} onOpenChange={setIsConcludeDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700" 
                disabled={concludeElection.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Conclude Election
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Conclude Election
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to conclude the election &quot;{election.name}&quot;?
                  <br /><br />
                  <strong>This action cannot be undone.</strong> Once concluded, no more votes can be cast and the final results will be locked in.
                  <br /><br />
                  Current vote count: <strong>{election.tallies.reduce((sum, tally) => sum + tally, 0)} total votes</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsConcludeDialogOpen(false)}
                  disabled={isTransitioning}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConcludeElection} 
                  disabled={isTransitioning}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isTransitioning ? (
                    <>
                      <Timer className="w-4 h-4 mr-2 animate-spin" />
                      Concluding...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Conclude Election
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Status Messages */}
        {!canCloseRegistration && !canConcludeElection && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isElectionEnded 
                ? "This election has concluded. Final results are available and no further changes can be made."
                : isVotingOpen 
                ? "Voting is currently open. Use the 'Conclude Election' button to end the voting phase."
                : "Election is in registration phase. Close registration to begin voting."
              }
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function ElectionDetailsCard({ election }: { election: ElectionPhase }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Election Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Election Name</p>
          <p className="font-semibold">{election.name}</p>
        </div>
        
        <Separator />
        
        <div>
          <p className="text-sm font-medium text-muted-foreground">Options</p>
          <div className="mt-2 space-y-2">
            {election.options.map((option, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="font-medium">{option}</span>
                <Badge variant="outline">{election.tallies[index] || 0} votes</Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-sm font-medium text-muted-foreground">Admin Address</p>
          <p className="font-mono text-xs break-all">{election.admin.toString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ElectionPhaseCard({ election }: { election: ElectionPhase }) {
  return (
    <BackgroundGradient className="rounded-[22px] p-1">
      <Card className="border-0 bg-background">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                {election.name}
              </CardTitle>
              <CardDescription>Manage election phases and monitor progress</CardDescription>
            </div>
            <ElectionStatusBadge election={election} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ElectionStatsCard election={election} />
          
          <div className="grid gap-6 lg:grid-cols-2">
            <PhaseControlPanel election={election} />
            <ElectionDetailsCard election={election} />
          </div>
        </CardContent>
      </Card>
    </BackgroundGradient>
  )
}

function ElectionsList() {
  const { adminElections, isLoading } = useElectionPhaseManager()

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (adminElections.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Settings className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No elections to manage</h3>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have any elections that you can manage. Create an election first to get started.
        </p>
        <Button>Create New Election</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {adminElections.map((election) => (
        <ElectionPhaseCard key={election.publicKey.toString()} election={election} />
      ))}
    </div>
  )
}

function MainContent() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      {/* Header with Spotlight Effect */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-900 via-blue-900 to-indigo-900 px-8 py-16 text-center text-white">
        <Spotlight className="absolute -top-40 left-0 md:left-60 md:-top-20" fill="white" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-4">
            Election Phase Management
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Control and monitor the phases of your elections. Transition from registration to voting with secure blockchain transactions.
          </p>
        </div>
      </div>

      {/* Elections List */}
      <ElectionsList />
    </div>
  )
}

export default function ElectionPhaseUI() {
  const { publicKey } = useWallet()

  if (!publicKey) {
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
                Connect your Solana wallet to manage election phases
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

  return (
    <SidebarUI>
      <MainContent />
    </SidebarUI>
  )
}