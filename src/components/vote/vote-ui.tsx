'use client'

import React, { useState, useRef } from 'react'
import { useWallet } from "@solana/wallet-adapter-react"
import { SidebarUI } from "../sidebar/sidebar-ui"
import { useVoteManager, Election } from './vote-data-access'
import { VoucherData } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { BackgroundGradient } from '@/components/ui/background-gradient'
import { Spotlight } from '@/components/ui/spotlight'
import { Timeline } from '@/components/ui/timeline'
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient'
import { TextGenerateEffect } from '@/components/ui/text-generate-effect'
import { TypewriterEffect } from '@/components/ui/typewriter-effect'
import { WalletButton } from '../solana/solana-provider'
import { 
  Vote,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Copy,
  Eye,
  EyeOff,
  Zap,
  Timer,
  Shield,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Download,
  UserCheck,
  FileCheck,
  Send,
  Trophy,
  Users,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { WalletStatus } from '../ui/wallet-status'

function ElectionStatusBadge({ election }: { election: Election }) {
  const { getElectionStatus } = useVoteManager()
  const status = getElectionStatus(election)

  const badgeConfig = {
    'not-started': { 
      variant: 'secondary' as const, 
      className: 'bg-gray-500',
      icon: Timer,
      label: 'Not Started'
    },
    'registration': { 
      variant: 'default' as const, 
      className: 'bg-blue-500 hover:bg-blue-600',
      icon: UserCheck,
      label: 'Registration Open'
    },
    'voting': { 
      variant: 'default' as const, 
      className: 'bg-green-500 hover:bg-green-600',
      icon: Vote,
      label: 'Voting Open'
    },
    'ended': { 
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

function ElectionSelectionStep({ onElectionSelect, selectedElection }: { 
  onElectionSelect: (election: Election) => void
  selectedElection: Election | null 
}) {
  const { availableElections, electionsLoading, canVoteInElection } = useVoteManager()

  if (electionsLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const eligibleElections = availableElections?.filter(canVoteInElection) || []

  if (eligibleElections.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Vote className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No elections available for voting</h3>
        <p className="text-muted-foreground mb-6">
          Elections must be in the voting phase (registration closed, voting open) to cast votes.
        </p>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Elections
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Select an Election</h2>
        <p className="text-muted-foreground">
          Choose an election to cast your vote
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {eligibleElections.map((election: Election, index: number) => (
          <BackgroundGradient key={index} className="rounded-[22px] p-1">
            <Card className="border-0 bg-background h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {election.name}
                  <ElectionStatusBadge election={election} />
                </CardTitle>
                <CardDescription>
                  {election.options.length} options available
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Admin:</span>
                    <span className="font-mono">{election.admin.toString().slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Votes:</span>
                    <span className="font-semibold">
                      {election.tallies.reduce((sum: number, count: number) => sum + count, 0)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Options:</Label>
                  <div className="flex flex-wrap gap-1">
                    {election.options.slice(0, 3).map((option: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                    {election.options.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{election.options.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Button 
                  onClick={() => onElectionSelect(election)}
                  className="w-full"
                  variant={selectedElection?.name === election.name ? "default" : "outline"}
                >
                  {selectedElection?.name === election.name ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Selected
                    </>
                  ) : (
                    <>
                      <Vote className="w-4 h-4 mr-2" />
                      Select Election
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </BackgroundGradient>
        ))}
      </div>
    </div>
  )
}

function OptionSelectionStep({ election, onOptionSelect, selectedOption }: {
  election: Election
  onOptionSelect: (option: string) => void
  selectedOption: string | null
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Cast Your Vote</h2>
        <p className="text-muted-foreground">
          Select your preferred option for "{election.name}"
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Election Information</h3>
            <ElectionStatusBadge election={election} />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm text-muted-foreground">Election Name</Label>
              <p className="font-medium">{election.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Total Votes Cast</Label>
              <p className="font-medium">
                {election.tallies.reduce((sum: number, count: number) => sum + count, 0)}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Current Results</Label>
            <div className="space-y-2 mt-2">
              {election.options.map((option: string, index: number) => {
                const votes = election.tallies[index] || 0
                const totalVotes = election.tallies.reduce((sum: number, count: number) => sum + count, 0)
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
                
                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{option}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {votes} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold">Select Your Choice</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {election.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="radio"
                id={`option-${index}`}
                name="election-option"
                value={option}
                checked={selectedOption === option}
                onChange={() => onOptionSelect(option)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label 
                htmlFor={`option-${index}`} 
                className="flex-1 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option}</span>
                  <Badge variant="outline" className="text-xs">
                    {election.tallies[index] || 0} votes
                  </Badge>
                </div>
              </Label>
            </div>
          ))}
        </div>

        {selectedOption && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              You have selected: <strong>{selectedOption}</strong>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

function VoucherUploadStep({ onVoucherUpload, voucher, election }: {
  onVoucherUpload: (voucher: VoucherData) => void
  voucher: VoucherData | null
  election: Election
}) {
  const { importVoucherFromFile, validateVoucher } = useVoteManager()
  const [manualVoucher, setManualVoucher] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const voucherData = await importVoucherFromFile(file)
      
      if (!validateVoucher(voucherData, election.name)) {
        throw new Error('Voucher is not valid for this election')
      }
      
      onVoucherUpload(voucherData)
      toast.success('Voucher loaded successfully')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleManualVoucherSubmit = () => {
    try {
      const voucherData = JSON.parse(manualVoucher) as VoucherData
      
      if (!validateVoucher(voucherData, election.name)) {
        throw new Error('Voucher is not valid for this election')
      }
      
      onVoucherUpload(voucherData)
      toast.success('Voucher loaded successfully')
    } catch (error) {
      toast.error('Invalid voucher format or content')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Upload Voting Voucher</h2>
        <p className="text-muted-foreground">
          Provide your voting voucher to authenticate your vote
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* File Upload Option */}
        <BackgroundGradient className="rounded-[22px] p-1">
          <Card className="border-0 bg-background p-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900 mx-auto w-fit">
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Upload Voucher File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your voucher JSON file
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </>
                )}
              </Button>
            </div>
          </Card>
        </BackgroundGradient>

        {/* Manual Input Option */}
        <BackgroundGradient className="rounded-[22px] p-1">
          <Card className="border-0 bg-background p-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900 mx-auto w-fit">
                <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Manual Input</h3>
                <p className="text-sm text-muted-foreground">
                  Paste your voucher JSON
                </p>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                {showManualInput ? 'Hide Input' : 'Manual Entry'}
              </Button>
            </div>
          </Card>
        </BackgroundGradient>
      </div>

      {showManualInput && (
        <Card className="p-6">
          <div className="space-y-4">
            <Label htmlFor="manual-voucher">Voucher JSON</Label>
            <Textarea
              id="manual-voucher"
              placeholder="Paste your voucher JSON here..."
              value={manualVoucher}
              onChange={(e) => setManualVoucher(e.target.value)}
              className="font-mono text-sm"
              rows={8}
            />
            <Button onClick={handleManualVoucherSubmit} className="w-full">
              <FileCheck className="w-4 h-4 mr-2" />
              Load Voucher
            </Button>
          </div>
        </Card>
      )}

      {voucher && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            Voucher loaded successfully for election: {voucher.electionName}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function VoteSubmissionStep({ 
  election, 
  selectedOption, 
  voucher, 
  onVoteSubmitted 
}: { 
  election: Election
  selectedOption: string
  voucher: VoucherData
  onVoteSubmitted: (result: any) => void 
}) {
  const { submitVote, isGeneratingProof, isSubmittingVote } = useVoteManager()

  const handleSubmitVote = async () => {
    try {
      const result = await submitVote.mutateAsync({
        electionName: election.name,
        selectedOption,
        voucher
      })
      onVoteSubmitted(result)
    } catch (error) {
      console.error('Failed to submit vote:', error)
    }
  }

  const timelineData = [
    {
      title: "Validate Voucher",
      content: (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm">Voucher validated successfully</span>
        </div>
      )
    },
    {
      title: "Generate ZK Proof",
      content: (
        <div className="flex items-center gap-2">
          {isGeneratingProof ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm">Generating zero-knowledge proof...</span>
            </>
          ) : (
            <>
              <Timer className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Waiting to generate proof</span>
            </>
          )}
        </div>
      )
    },
    {
      title: "Submit Transaction",
      content: (
        <div className="flex items-center gap-2">
          {isSubmittingVote ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm">Submitting vote to blockchain...</span>
            </>
          ) : (
            <>
              <Timer className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Ready to submit</span>
            </>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Submit Your Vote</h2>
        <p className="text-muted-foreground">
          Review and confirm your vote for "{election.name}"
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Vote Summary</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm text-muted-foreground">Election</Label>
              <p className="font-medium">{election.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Your Choice</Label>
              <p className="font-medium text-blue-600">{selectedOption}</p>
            </div>
          </div>
          
          <div>
            <Label className="text-sm text-muted-foreground">Voucher ID</Label>
            <p className="font-mono text-xs break-all">{voucher.nullifier.slice(0, 32)}...</p>
          </div>
        </div>
      </Card>


      <div className="flex justify-center">
        <div className={cn(
          "inline-block",
          (isGeneratingProof || isSubmittingVote) && "opacity-50 pointer-events-none"
        )}>
          <HoverBorderGradient
            containerClassName="rounded-full"
            as="button"
            className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 px-8 py-4"
            onClick={handleSubmitVote}
          >
            {isGeneratingProof || isSubmittingVote ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>
                  {isGeneratingProof ? 'Generating Proof...' : 'Submitting Vote...'}
                </span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Submit Vote</span>
              </>
            )}
          </HoverBorderGradient>
        </div>
      </div>
    </div>
  )
}

function VoteConfirmationStep({ voteResult }: { voteResult: any }) {
  const [showDetails, setShowDetails] = useState(false)
  const router = useRouter()

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-green-600">Vote Submitted Successfully!</h2>
        <p className="text-muted-foreground">
          Your vote has been recorded on the blockchain
        </p>
      </div>

      <BackgroundGradient className="rounded-[22px] p-1">
        <Card className="border-0 bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-green-500" />
              Vote Confirmation
            </CardTitle>
            <CardDescription>
              Transaction confirmed on Solana blockchain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Election</Label>
                <p className="font-medium">{voteResult.electionName}</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Your Vote</Label>
                <p className="font-medium text-green-600">{voteResult.selectedOption}</p>
              </div>
            </div>

            {voteResult.transactionSignature && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Transaction ID</Label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs break-all flex-1">
                    {voteResult.transactionSignature}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(voteResult.transactionSignature, 'Transaction ID')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => setShowDetails(!showDetails)}
                className="flex-1"
              >
                {showDetails ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Details
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => router.push('/dasboard')}
                className="flex-1"
              >
                <Vote className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>

            {showDetails && (
              <div className="space-y-4">
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Vote Details</Label>
                  <Textarea
                    value={JSON.stringify(voteResult, null, 2)}
                    readOnly
                    className="font-mono text-xs"
                    rows={8}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </BackgroundGradient>
    </div>
  )
}

function VotingWizard() {
  const searchParams = useSearchParams()
  const { availableElections } = useVoteManager()
  const electionFromUrl = searchParams.get('election')
  
  // Find election from URL parameter
  const [preSelectedElection, setPreSelectedElection] = useState<Election | null>(null)
  
  React.useEffect(() => {
    if (electionFromUrl && availableElections) {
      const decodedName = decodeURIComponent(electionFromUrl)
      const election = availableElections.find(e => e.name.toLowerCase() === decodedName.toLowerCase())
      setPreSelectedElection(election || null)
    }
  }, [electionFromUrl, availableElections])
  
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedElection, setSelectedElection] = useState<Election | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<VoucherData | null>(null)
  const [voteResult, setVoteResult] = useState<any>(null)

  React.useEffect(() => {
    if (preSelectedElection) {
      setSelectedElection(preSelectedElection)
      setCurrentStep(2)
    }
  }, [preSelectedElection])

  const steps = [
    { number: 1, title: "Select Election", description: "Choose the election to vote in" },
    { number: 2, title: "Select Option", description: "Choose your preferred candidate" },
    { number: 3, title: "Upload Voucher", description: "Provide your voting voucher" },
    { number: 4, title: "Submit Vote", description: "Confirm and submit your vote" },
    { number: 5, title: "Confirmation", description: "Vote recorded successfully" }
  ]

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2: return !!selectedElection
      case 3: return !!selectedElection && !!selectedOption
      case 4: return !!selectedElection && !!selectedOption && !!voucher
      case 5: return !!voteResult
      default: return true
    }
  }

  const resetWizard = () => {
    setCurrentStep(preSelectedElection ? 2 : 1)
    if (!preSelectedElection) {
      setSelectedElection(null)
    }
    setSelectedOption(null)
    setVoucher(null)
    setVoteResult(null)
  }

  return (
    <div className="space-y-8">
      {/* Election Info Banner (if pre-selected) */}
      {preSelectedElection && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Vote className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Voting in: {preSelectedElection.name}
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {preSelectedElection.options.length} voting options available
                </p>
              </div>
              <ElectionStatusBadge election={preSelectedElection} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            if (preSelectedElection && step.number === 1) return null;
            
            return (
              <div key={step.number} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium",
                  currentStep >= step.number 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "border-muted-foreground text-muted-foreground"
                )}>
                  {currentStep > step.number ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    preSelectedElection && step.number > 1 ? step.number - 1 : step.number
                  )}
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.filter(s => !preSelectedElection || s.number !== 1).length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && !preSelectedElection && (
          <ElectionSelectionStep 
            onElectionSelect={setSelectedElection}
            selectedElection={selectedElection}
          />
        )}
        
        {currentStep === 2 && selectedElection && (
          <OptionSelectionStep 
            election={selectedElection}
            onOptionSelect={setSelectedOption}
            selectedOption={selectedOption}
          />
        )}
        
        {currentStep === 3 && selectedElection && (
          <VoucherUploadStep 
            onVoucherUpload={setVoucher}
            voucher={voucher}
            election={selectedElection}
          />
        )}
        
        {currentStep === 4 && selectedElection && selectedOption && voucher && (
          <VoteSubmissionStep 
            election={selectedElection}
            selectedOption={selectedOption}
            voucher={voucher}
            onVoteSubmitted={(result) => {
              setVoteResult(result)
              setCurrentStep(5)
            }}
          />
        )}
        
        {currentStep === 5 && voteResult && (
          <VoteConfirmationStep voteResult={voteResult} />
        )}
      </div>

      {/* Navigation */}
      {currentStep < 5 && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline"
              onClick={() => {
                if (currentStep > (preSelectedElection ? 2 : 1)) {
                  setCurrentStep(currentStep - 1)
                } else {
                  resetWizard()
                }
              }}
              disabled={currentStep === 4} // Disable back during submission
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {currentStep === (preSelectedElection ? 2 : 1) ? 'Reset' : 'Previous'}
            </Button>
            
            <div className="text-sm text-muted-foreground">
              Step {preSelectedElection ? currentStep - 1 : currentStep} of {preSelectedElection ? 4 : 5}
            </div>
            
            {currentStep < 4 && (
              <Button 
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceedToStep(currentStep + 1)}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function MainContent() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 px-6 py-12 text-center text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-indigo-600/80" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold">
            ZK Voting Portal
          </h1>
          <p className="mt-2 text-blue-100">
            Cast your secure zero-knowledge vote
          </p>
        </div>
      </div>

      {/* Voting Wizard */}
      <VotingWizard />
    </div>
  )
}

export default function VoteUI() {
  const { publicKey, connecting } = useWallet()
  const router = useRouter()

  if(connecting) {
    return (
      <>Loading</>
    )
  }

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