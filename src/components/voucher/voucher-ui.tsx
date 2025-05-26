'use client'

import React, { useState, useRef } from 'react'
import { useWallet } from "@solana/wallet-adapter-react"
import { ConnectWallet } from "../connect-wallet"
import { SidebarUI } from "../sidebar/sidebar-ui"
import { useVoucherManager, Election, VoucherData } from './voucher-data-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { BackgroundGradient } from '@/components/ui/background-gradient'
import { Spotlight } from '@/components/ui/spotlight'
import { Timeline } from '@/components/ui/timeline'
import { HoverEffect } from '@/components/ui/card-hover-effect'
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient'
import { TextGenerateEffect } from '@/components/ui/text-generate-effect'
import { TypewriterEffect } from '@/components/ui/typewriter-effect'
import { WalletButton } from '../solana/solana-provider'
import { 
  Download,
  Upload,
  FileKey,
  Vote,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Crown,
  Activity,
  Copy,
  Eye,
  EyeOff,
  Zap,
  Timer,
  Shield,
  FileText,
  Code,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Save,
  Key
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

function ElectionStatusBadge({ election }: { election: Election }) {
  const { getElectionStatus } = useVoucherManager()
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
      icon: Upload,
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
  const { availableElections, electionsLoading, canDownloadVoucher } = useVoucherManager()

  if (electionsLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const eligibleElections = availableElections.filter(canDownloadVoucher)

  if (eligibleElections.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Vote className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No eligible elections found</h3>
        <p className="text-muted-foreground mb-6">
          Vouchers can only be downloaded for elections where registration is closed and voting is open.
        </p>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Elections
        </Button>
      </Card>
    )
  }

  const electionCards = eligibleElections.map((election) => ({
    title: election.name,
    description: `${election.options.length} options available`,
    content: (
      <div className="space-y-3">
        <ElectionStatusBadge election={election} />
        <div className="text-sm space-y-1">
          <p><span className="font-medium">Admin:</span> {election.admin.toString().slice(0, 12)}...</p>
          <p><span className="font-medium">Options:</span> {election.options.join(', ')}</p>
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
      </div>
    )
  }))

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Select an Election</h2>
        <p className="text-muted-foreground">
          Choose an election to download your voting voucher
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {electionCards.map((card, index) => (
          <BackgroundGradient key={index} className="rounded-[22px] p-1">
            <Card className="border-0 bg-background h-full">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {card.content}
              </CardContent>
            </Card>
          </BackgroundGradient>
        ))}
      </div>
    </div>
  )
}

function SecretKeyInputStep({ onSecretKeyUpload, secretKey }: { 
  onSecretKeyUpload: (key: Uint8Array) => void
  secretKey: Uint8Array | null 
}) {
  const { importSecretKeyFromFile, validateSecretKey } = useVoucherManager()
  const [manualKey, setManualKey] = useState('')
  const [hexKey, setHexKey] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [showHexInput, setShowHexInput] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const key = await importSecretKeyFromFile(file)
      onSecretKeyUpload(key)
      toast.success('Secret key loaded successfully')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleManualKeySubmit = () => {
    try {
      const keyArray = new Uint8Array(JSON.parse(manualKey))
      if (!validateSecretKey(keyArray)) {
        throw new Error('Invalid secret key format')
      }
      onSecretKeyUpload(keyArray)
      toast.success('Secret key loaded successfully')
    } catch (error) {
      toast.error('Invalid secret key format')
    }
  }

  const handleHexKeySubmit = () => {
    try {
      // Remove 0x prefix if present and any whitespace
      const cleanHex = hexKey.replace(/^0x/, '').replace(/\s/g, '')
      
      // Validate hex format
      if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
        throw new Error('Invalid hex format')
      }
      
      // Convert to Uint8Array
      const keyArray = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
      
      if (!validateSecretKey(keyArray)) {
        throw new Error('Invalid secret key length (must be 32 bytes)')
      }
      
      onSecretKeyUpload(keyArray)
      toast.success('Secret key loaded successfully')
    } catch (error: any) {
      toast.error(error.message || 'Invalid hex secret key')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Upload Secret Key</h2>
        <p className="text-muted-foreground">
          Provide your secret key to generate the voting voucher
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* File Upload Option */}
        <BackgroundGradient className="rounded-[22px] p-1">
          <Card className="border-0 bg-background p-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900 mx-auto w-fit">
                <FileKey className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Upload Key File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your secret.key file
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".key,.json,.txt"
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

        {/* Hex Input Option */}
        <BackgroundGradient className="rounded-[22px] p-1">
          <Card className="border-0 bg-background p-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900 mx-auto w-fit">
                <Code className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Hex Input</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your secret key as hex
                </p>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setShowHexInput(!showHexInput)}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                {showHexInput ? 'Hide Hex Input' : 'Hex Entry'}
              </Button>
            </div>
          </Card>
        </BackgroundGradient>

        {/* Manual Input Option */}
        <BackgroundGradient className="rounded-[22px] p-1">
          <Card className="border-0 bg-background p-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900 mx-auto w-fit">
                <Key className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">JSON Array</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your secret key as JSON array
                </p>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full"
              >
                <Code className="w-4 h-4 mr-2" />
                {showManualInput ? 'Hide JSON Input' : 'JSON Entry'}
              </Button>
            </div>
          </Card>
        </BackgroundGradient>
      </div>

      {showHexInput && (
        <Card className="p-6">
          <div className="space-y-4">
            <Label htmlFor="hex-key">Secret Key (Hex Format)</Label>
            <Input
              id="hex-key"
              placeholder="0x1234567890abcdef... or 1234567890abcdef..."
              value={hexKey}
              onChange={(e) => setHexKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter your 32-byte secret key in hexadecimal format (64 hex characters)
            </p>
            <Button onClick={handleHexKeySubmit} className="w-full">
              <Key className="w-4 h-4 mr-2" />
              Load Hex Secret Key
            </Button>
          </div>
        </Card>
      )}

      {showManualInput && (
        <Card className="p-6">
          <div className="space-y-4">
            <Label htmlFor="manual-key">Secret Key (JSON Array)</Label>
            <Textarea
              id="manual-key"
              placeholder="[123, 45, 67, 89, ...]"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              className="font-mono text-sm"
              rows={6}
            />
            <Button onClick={handleManualKeySubmit} className="w-full">
              <Key className="w-4 h-4 mr-2" />
              Load JSON Secret Key
            </Button>
          </div>
        </Card>
      )}

      {secretKey && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            Secret key loaded successfully ({secretKey.length} bytes)
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function VoucherGenerationStep({ 
  election, 
  secretKey, 
  onVoucherGenerated 
}: { 
  election: Election
  secretKey: Uint8Array
  onVoucherGenerated: (voucher: VoucherData) => void 
}) {
  const { downloadVoucher, isGeneratingProof } = useVoucherManager()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateVoucher = async () => {
    setIsGenerating(true)
    try {
      const voucher = await downloadVoucher.mutateAsync({
        secretKey,
        electionName: election.name
      })
      onVoucherGenerated(voucher)
    } catch (error) {
      console.error('Failed to generate voucher:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const timelineData = [
    {
      title: "Validate Secret Key",
      content: (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm">Secret key validated successfully</span>
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
      title: "Fetch Registration Data",
      content: (
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Retrieve voter data from IPFS</span>
        </div>
      )
    },
    {
      title: "Create Merkle Proof",
      content: (
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Generate Merkle tree witness</span>
        </div>
      )
    },
    {
      title: "Generate Voucher",
      content: (
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Compile voting voucher</span>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Generate Voting Voucher</h2>
        <p className="text-muted-foreground">
          Create your authenticated voting voucher for "{election.name}"
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
              <Label className="text-sm text-muted-foreground">Options Available</Label>
              <p className="font-medium">{election.options.length}</p>
            </div>
          </div>
          
          <div>
            <Label className="text-sm text-muted-foreground">Voting Options</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {election.options.map((option, index) => (
                <Badge key={index} variant="outline">{option}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold">Generation Process</h3>
        <Timeline data={timelineData} />
      </div>

      <div className="flex justify-center">
        <div className={cn(
          "inline-block",
          (isGenerating || downloadVoucher.isPending) && "opacity-50 pointer-events-none"
        )}>
          <HoverBorderGradient
            containerClassName="rounded-full"
            as="button"
            className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 px-8 py-4"
            onClick={handleGenerateVoucher}
          >
            {isGenerating || downloadVoucher.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Voucher...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>Generate Secure Voucher</span>
              </>
            )}
          </HoverBorderGradient>
        </div>
      </div>
    </div>
  )
}

function VoucherDisplayStep({ voucher }: { voucher: VoucherData }) {
  const { exportVoucherToJSON } = useVoucherManager()
  const [showRawData, setShowRawData] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(`${field} copied to clipboard`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const downloadVoucherFile = () => {
    const voucherJson = exportVoucherToJSON(voucher)
    const blob = new Blob([voucherJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `voucher-${voucher.electionName}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Voucher downloaded successfully')
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-green-600">Voucher Generated Successfully!</h2>
        <p className="text-muted-foreground">
          Your voting voucher for "{voucher.electionName}" is ready
        </p>
      </div>

      <BackgroundGradient className="rounded-[22px] p-1">
        <Card className="border-0 bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              Voting Voucher
            </CardTitle>
            <CardDescription>
              Generated on {voucher.generatedAt.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Election</Label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm">{voucher.election.toString()}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(voucher.election.toString(), 'Election ID')}
                  >
                    {copiedField === 'Election ID' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Leaf Index</Label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm">{voucher.leaf_index}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(voucher.leaf_index.toString(), 'Leaf Index')}
                  >
                    {copiedField === 'Leaf Index' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Nullifier</Label>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs break-all">{voucher.nullifier}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(voucher.nullifier, 'Nullifier')}
                >
                  {copiedField === 'Nullifier' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Merkle Root</Label>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs break-all">{voucher.merkle_root}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(voucher.merkle_root, 'Merkle Root')}
                >
                  {copiedField === 'Merkle Root' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex gap-4">
              <Button onClick={downloadVoucherFile} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Voucher
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowRawData(!showRawData)}
                className="flex-1"
              >
                {showRawData ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Raw Data
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Raw Data
                  </>
                )}
              </Button>
            </div>

            {showRawData && (
              <div className="space-y-4">
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Raw Voucher Data</Label>
                  <Textarea
                    value={exportVoucherToJSON(voucher)}
                    readOnly
                    className="font-mono text-xs"
                    rows={12}
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

function VoucherWizard() {
  const searchParams = useSearchParams()
  const { getElectionByName } = useVoucherManager()
  const electionFromUrl = searchParams.get('election')
  
  // Auto-select election from URL parameter
  const preSelectedElection = electionFromUrl ? getElectionByName(electionFromUrl) : null
  
  const [currentStep, setCurrentStep] = useState(preSelectedElection ? 2 : 1) // Skip election selection if provided
  const [selectedElection, setSelectedElection] = useState<Election | null>(preSelectedElection)
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null)
  const [generatedVoucher, setGeneratedVoucher] = useState<VoucherData | null>(null)

  const steps = [
    { number: 1, title: "Select Election", description: "Choose the election to vote in" },
    { number: 2, title: "Upload Secret Key", description: "Provide your secret key" },
    { number: 3, title: "Generate Voucher", description: "Create your voting voucher" },
    { number: 4, title: "Download Voucher", description: "Save your voucher" }
  ]

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2: return !!selectedElection
      case 3: return !!selectedElection && !!secretKey
      case 4: return !!selectedElection && !!secretKey && !!generatedVoucher
      default: return true
    }
  }

  const resetWizard = () => {
    setCurrentStep(preSelectedElection ? 2 : 1) // Reset to appropriate starting step
    if (!preSelectedElection) {
      setSelectedElection(null)
    }
    setSecretKey(null)
    setGeneratedVoucher(null)
  }

  return (
    <div className="space-y-8">
      {/* Election Info Banner (if pre-selected) */}
      {preSelectedElection && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Vote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Downloading voucher for: {preSelectedElection.name}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
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
            // Skip step 1 if election is pre-selected
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
      <div className="min-h-[600px]">
        {currentStep === 1 && !preSelectedElection && (
          <ElectionSelectionStep 
            onElectionSelect={setSelectedElection}
            selectedElection={selectedElection}
          />
        )}
        
        {currentStep === 2 && (
          <SecretKeyInputStep 
            onSecretKeyUpload={setSecretKey}
            secretKey={secretKey}
          />
        )}
        
        {currentStep === 3 && selectedElection && secretKey && (
          <VoucherGenerationStep 
            election={selectedElection}
            secretKey={secretKey}
            onVoucherGenerated={(voucher) => {
              setGeneratedVoucher(voucher)
              setCurrentStep(4)
            }}
          />
        )}
        
        {currentStep === 4 && generatedVoucher && (
          <VoucherDisplayStep voucher={generatedVoucher} />
        )}
      </div>

      {/* Navigation */}
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
            disabled={currentStep === 3} // Disable back during generation
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === (preSelectedElection ? 2 : 1) ? 'Reset' : 'Previous'}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Step {preSelectedElection ? currentStep - 1 : currentStep} of {preSelectedElection ? 3 : 4}
          </div>
          
          {currentStep < 4 && currentStep !== 3 && (
            <Button 
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceedToStep(currentStep + 1)}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          
          {currentStep === 4 && (
            <Button onClick={resetWizard}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Another
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

function MainContent() {
  const words = [
    { text: "Download" },
    { text: "your" },
    { text: "secure" },
    { text: "voting", className: "text-blue-500 dark:text-blue-400" },
    { text: "voucher", className: "text-blue-500 dark:text-blue-400" },
  ]

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      {/* Header with Spotlight Effect */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 px-8 py-16 text-center text-white">
        <Spotlight className="absolute -top-40 left-0 md:left-60 md:-top-20" fill="white" />
        <div className="relative z-10 space-y-4">
          <TypewriterEffect words={words} className="text-4xl font-bold" />
          <TextGenerateEffect 
            words="Generate authenticated vouchers for zero-knowledge voting with cryptographic proofs and Merkle tree verification."
            className="text-lg text-purple-100 max-w-3xl mx-auto"
          />
        </div>
      </div>

      {/* Voucher Wizard */}
      <VoucherWizard />
    </div>
  )
}

export default function VoucherUI() {
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
                Connect your Solana wallet to download voting vouchers
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