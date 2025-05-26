'use client'

import React, { useState } from 'react';
import { SidebarUI } from '../sidebar/sidebar-ui';
import { useZkVotingProgram } from './dashboard-data-access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { 
  Calendar, 
  Vote, 
  TrendingUp, 
  Activity,
  BarChart3,
  Crown,
  Zap,
  MoreHorizontal,
  Eye,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransactionToast } from '@/components/use-transaction-toast';
import { WalletButton } from '../solana/solana-provider';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

function ElectionStatusBadge({ election }: { election: any }) {
  const now = Date.now() / 1000;
  const startTime = election.account?.startTime || 0;
  const endTime = election.account?.endTime || 0;
  const isRegistrationOpen = election.account?.isRegistrationOpen || false;
  const isVotingOpen = election.account?.isVotingOpen || false;

  if (now < startTime) {
    return <Badge variant="secondary">Upcoming</Badge>;
  } else if (isRegistrationOpen) {
    return <Badge variant="default" className="bg-blue-500">Registration Open</Badge>;
  } else if (isVotingOpen) {
    return <Badge variant="default" className="bg-green-500">Voting Open</Badge>;
  } else if (now > endTime) {
    return <Badge variant="outline">Ended</Badge>;
  } else {
    return <Badge variant="secondary">Inactive</Badge>;
  }
}

function ElectionCard({ election }: { election: any }) {
  const { getElectionStats } = useZkVotingProgram();
  const router = useRouter();
  const stats = getElectionStats(election);
  
  const canDownloadVoucher = !election.account?.isRegistrationOpen && election.account?.isVotingOpen;
  const electionName = election.account?.name || 'Unnamed Election';
  
  const handleDownloadVoucher = () => {
    const encodedName = encodeURIComponent(electionName);
    router.push(`/voucher?election=${encodedName}`);
  };
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{electionName}</CardTitle>
            <CardDescription className="text-sm">
              {election.account?.description || 'No description available'}
            </CardDescription>
          </div>
          <ElectionStatusBadge election={election} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Total Votes</p>
            <p className="font-semibold">{stats.totalVotes}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Options</p>
            <p className="font-semibold">{stats.totalOptions}</p>
          </div>
        </div>
        
        {stats.leadingOption && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Leading Option</p>
            <p className="font-medium text-sm">{stats.leadingOption}</p>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          {canDownloadVoucher ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              onClick={handleDownloadVoucher}
            >
              <Vote className="w-4 h-4 mr-1" />
              Voucher
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1" disabled>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsOverview() {
  const { elections, adminElections } = useZkVotingProgram();
  const router = useRouter();
  
  if (!elections || elections.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalElections = elections.length;
  const activeElections = elections.filter((e: any) => e.account?.isVotingOpen || e.account?.isRegistrationOpen).length;
  const totalVotes = elections.reduce((sum: any, election: any) => 
    sum + (election.account?.tallies?.reduce((s: any, t: any) => s + t.toNumber(), 0) || 0), 0
  );
  const myElections = adminElections.length;

  const stats = [
    {
      title: "Total Elections",
      value: totalElections.toString(),
      description: "Elections on the network",
      icon: Vote,
      gradient: "from-blue-500 to-purple-600"
    },
    {
      title: "Active Elections", 
      value: activeElections.toString(),
      description: "Currently accepting votes",
      icon: Activity,
      gradient: "from-green-500 to-teal-600"
    },
    {
      title: "Total Votes",
      value: totalVotes.toString(),
      description: "Votes cast across all elections",
      icon: TrendingUp,
      gradient: "from-orange-500 to-red-600"
    },
    {
      title: "My Elections",
      value: myElections.toString(), 
      description: "Elections you administer",
      icon: Crown,
      gradient: "from-purple-500 to-pink-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={cn("p-2 rounded-md bg-gradient-to-r", stat.gradient)}>
              <stat.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ElectionTable() {
  const { elections, isLoading, getElectionStats } = useZkVotingProgram();
  const { publicKey } = useWallet();
  const router = useRouter();
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Elections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredElections = showOnlyMine 
    ? elections?.filter((e: any) => publicKey && e.account?.admin?.equals(publicKey)) || []
    : elections || [];

  const handleDownloadVoucher = (electionName: string) => {
    const encodedName = encodeURIComponent(electionName);
    router.push(`/voucher?election=${encodedName}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Elections
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyMine(!showOnlyMine)}
          >
            {showOnlyMine ? 'Show All' : 'Show Mine'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Election</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Total Votes</TableHead>
              <TableHead>Leading Option</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredElections.map((election: any) => {
              const stats = getElectionStats(election);
              const isMyElection = publicKey && election.account?.admin?.equals(publicKey);
              const canDownloadVoucher = !election.account?.isRegistrationOpen && election.account?.isVotingOpen;
              const electionName = election.account?.name || 'Unnamed Election';
              
              return (
                <TableRow key={election.publicKey.toString()}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {electionName}
                      {isMyElection && <Crown className="w-4 h-4 text-yellow-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ElectionStatusBadge election={election} />
                  </TableCell>
                  <TableCell>{stats.totalOptions}</TableCell>
                  <TableCell>{stats.totalVotes}</TableCell>
                  <TableCell>{stats.leadingOption || 'N/A'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {election.account?.admin?.toString().slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canDownloadVoucher && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          onClick={() => handleDownloadVoucher(electionName)}
                        >
                          <Vote className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredElections.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {showOnlyMine ? 'No elections found that you administer' : 'No elections found'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MainContent() {
  const { elections, isLoading } = useZkVotingProgram();
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 px-6 py-12 text-center text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-indigo-600/80" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold">
            ZK Voting Dashboard
          </h1>
          <p className="mt-2 text-blue-100">
            Privacy-preserving elections on Solana
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <StatsOverview />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Phase Management</h3>
              <p className="text-sm text-muted-foreground">Control election phases and transitions</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard/phase')}
            >
              Manage
            </Button>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
              <Vote className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Create Election</h3>
              <p className="text-sm text-muted-foreground">Start a new election</p>
            </div>
            <Button variant="outline">
              Create
            </Button>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">View Results</h3>
              <p className="text-sm text-muted-foreground">Analyze election results</p>
            </div>
            <Button variant="outline">
              Analyze
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent Elections Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Recent Elections
          </h2>
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>
        
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : elections && elections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {elections.slice(0, 6).map((election: any) => (
              <ElectionCard key={election.publicKey.toString()} election={election} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Vote className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No elections found</h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first election or check your network connection.
            </p>
            <Button>Create Election</Button>
          </Card>
        )}
      </div>

      {/* Elections Table */}
      <ElectionTable />
    </div>
  );
}

export default function DashboardUI() {
  const { publicKey } = useWallet();

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
                Connect your Solana wallet to access the ZK Voting Dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletButton />
            </CardContent>
          </Card>
        </div>
      </SidebarUI>
    );
  }

  return (
    <SidebarUI>
      <MainContent />
    </SidebarUI>
  );
}