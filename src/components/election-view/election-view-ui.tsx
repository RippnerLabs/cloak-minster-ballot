'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SidebarUI } from "../sidebar/sidebar-ui"
import { useElectionView, ElectionView } from './election-view-data-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { BackgroundGradient } from '@/components/ui/background-gradient'
import { Spotlight } from '@/components/ui/spotlight'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { 
  Vote,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  Activity,
  BarChart3,
  TrendingUp,
  ArrowLeft,
  Zap,
  AlertTriangle,
  Eye,
  Download,
  UserCheck,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ElectionStatusBadge({ election }: { election: ElectionView }) {
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

function ElectionStatsCard({ election, getElectionStats }: { election: ElectionView, getElectionStats: (election: ElectionView) => any }) {
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

function ElectionDetailsCard({ election }: { election: ElectionView }) {
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
          <p className="text-sm font-medium text-muted-foreground">Voting Options</p>
          <div className="mt-2 space-y-2">
            {election.options.map((option, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">{option}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{election.tallies[index] || 0} votes</Badge>
                  {election.tallies[index] > 0 && (
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.max(10, (election.tallies[index] / Math.max(...election.tallies)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  )}
                </div>
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

function ElectionPhaseStatusCard({ election }: { election: ElectionView }) {
  const isRegistrationOpen = election.isRegistrationOpen
  const isVotingOpen = election.isVotingOpen
  const isElectionEnded = !isRegistrationOpen && !isVotingOpen

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Election Phase Status
        </CardTitle>
        <CardDescription>
          Current phase and status of the election
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
                <p className="text-sm text-muted-foreground">Voters register and submit proofs</p>
              </div>
            </div>
            {isRegistrationOpen ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Vote className={cn("w-5 h-5", isVotingOpen ? "text-green-500" : "text-gray-400")} />
              <div>
                <p className="font-medium">Voting Phase</p>
                <p className="text-sm text-muted-foreground">Registered voters cast their ballots</p>
              </div>
            </div>
            {isVotingOpen ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
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
      </CardContent>
    </Card>
  )
}

function ElectionActionsCard({ election }: { election: ElectionView }) {
  const router = useRouter()
  const electionName = election.name

  const canVote = !election.isRegistrationOpen && election.isVotingOpen
  const canRegister = election.isRegistrationOpen
  const canVoucher = canVote

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Available Actions
        </CardTitle>
        <CardDescription>
          Actions you can take for this election
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canRegister && (
          <Button 
            className="w-full" 
            onClick={() => router.push(`/register?election=${encodeURIComponent(electionName)}`)}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Register to Vote
          </Button>
        )}
        
        {canVoucher && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push(`/voucher?election=${encodeURIComponent(electionName)}`)}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Voucher
          </Button>
        )}
        
        {canVote && (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => router.push(`/vote?election=${encodeURIComponent(electionName)}`)}
          >
            <Vote className="w-4 h-4 mr-2" />
            Cast Your Vote
          </Button>
        )}

        {!canRegister && !canVote && !canVoucher && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This election has concluded. No further actions are available.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function ElectionViewCard({ election, getElectionStats, isAdmin }: { 
  election: ElectionView, 
  getElectionStats: (election: ElectionView) => any,
  isAdmin: boolean 
}) {
  const router = useRouter()

  return (
    <BackgroundGradient className="rounded-[22px] p-1">
      <Card className="border-0 bg-background">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {isAdmin && <Crown className="w-5 h-5 text-yellow-500" />}
                <Eye className="w-5 h-5 text-blue-500" />
                {election.name}
              </CardTitle>
              <CardDescription>
                {isAdmin ? 'You are the administrator of this election' : 'Election details and current status'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ElectionStatusBadge election={election} />
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/dashboard/phase')}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Manage
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ElectionStatsCard election={election} getElectionStats={getElectionStats} />
          
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <ElectionDetailsCard election={election} />
              <ElectionActionsCard election={election} />
            </div>
            <ElectionPhaseStatusCard election={election} />
          </div>
        </CardContent>
      </Card>
    </BackgroundGradient>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function ErrorState({ electionName }: { electionName: string }) {
  const router = useRouter()
  
  return (
    <Card className="p-12 text-center">
      <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <h3 className="text-lg font-medium mb-2">Election Not Found</h3>
      <p className="text-muted-foreground mb-6">
        The election &quot;{electionName}&quot; could not be found or may not exist.
      </p>
      <Button onClick={() => router.push('/dashboard')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
    </Card>
  )
}

function MainContent() {
  const params = useParams()
  const router = useRouter()
  const electionName = decodeURIComponent(params.name as string)
  
  const { election, isLoading, error, getElectionStats, isAdmin } = useElectionView(electionName)

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-6">
        {/* Header Skeleton */}
        <Skeleton className="h-32 w-full rounded-lg" />
        <LoadingState />
      </div>
    )
  }

  if (error || !election) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-6">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-red-900 via-red-800 to-red-900 px-8 py-16 text-center text-white">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-4">Election Not Found</h1>
            <p className="text-lg text-red-100 max-w-2xl mx-auto">
              The requested election could not be loaded.
            </p>
          </div>
        </div>
        <ErrorState electionName={electionName} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      {/* Header with Spotlight Effect */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 px-6 py-12 text-center text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-indigo-600/80" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-4xl font-bold">
            Election Details
          </h1>
          <p className="mt-2 text-blue-100">
            View comprehensive information about &quot;{election.name}&quot; including current status, voting options, and results.
          </p>
        </div>
      </div>

      {/* Election Details */}
      <ElectionViewCard election={election} getElectionStats={getElectionStats} isAdmin={isAdmin} />
    </div>
  )
}

export default function ElectionViewUI() {
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
                Connect your Solana wallet to view election details
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