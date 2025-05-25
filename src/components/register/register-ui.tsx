'use client'

import { useState } from 'react'
import { useWallet } from "@solana/wallet-adapter-react"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  Shield, 
  Zap,
  Copy,
  ExternalLink,
  Wallet,
  Key,
  Eye,
  EyeOff
} from 'lucide-react'
import { ConnectWallet } from "../connect-wallet"
import { SidebarUI } from "../sidebar/sidebar-ui"
import { WalletButton } from '../solana/solana-provider'
import { useRegisterVoter, type RegistrationFormData } from './register-data-access'
import { toast } from 'sonner'

// Form validation schema (simplified)
const registrationSchema = z.object({
  electionName: z.string()
    .min(1, 'Please select an election')
    .max(32, 'Election name too long'),
})

type FormData = z.infer<typeof registrationSchema>

const STEPS = [
  {
    id: 1,
    title: 'Connect Wallet & Select Election',
    description: 'Connect your wallet and choose an election to participate in'
  },
  {
    id: 2,
    title: 'Generate Secret Key',
    description: 'Generate your unique secret key for zero-knowledge proof generation'
  },
  {
    id: 3,
    title: 'Complete Registration',
    description: 'Generate your ZK proof and complete voter registration'
  },
  {
    id: 4,
    title: 'Registration Complete',
    description: 'Your voter registration has been successfully completed'
  }
]

function MainContent() {
  const { connected, publicKey } = useWallet()
  const {
    currentStep,
    registrationData,
    zkProof,
    isGeneratingProof,
    isGeneratingSecret,
    elections,
    isLoadingElections,
    generateSecret,
    generateProof,
    registerVoter,
    updateRegistrationData,
    nextStep,
    prevStep,
    setCurrentStep,
    getSecretKeyHex
  } = useRegisterVoter()

  const [showSecret, setShowSecret] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      electionName: '',
    }
  })

  const { setValue, getValues } = form

  // Get available elections for registration
  const availableElections = elections.filter(election => 
    election.isRegistrationOpen && !election.isVotingOpen
  )

  const handleElectionSelect = (electionName: string) => {
    setValue('electionName', electionName)
    updateRegistrationData({ electionName })
  }

  const handleGenerateSecret = async () => {
    try {
      await generateSecret.mutateAsync()
    } catch (error) {
      console.error('Error generating secret:', error)
    }
  }

  const handleGenerateProof = async () => {
    const { electionName } = getValues()
    
    if (!electionName) {
      toast.error('Please select an election')
      return
    }

    if (!registrationData.generatedSecret) {
      toast.error('Please generate your secret key first')
      return
    }

    try {
      await generateProof.mutateAsync({ electionName })
    } catch (error) {
      console.error('Error generating proof:', error)
    }
  }

  const handleRegister = async () => {
    try {
      await registerVoter.mutateAsync()
    } catch (error) {
      console.error('Error registering voter:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const progress = (currentStep / STEPS.length) * 100

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Required
            </CardTitle>
            <CardDescription>
              Please connect your wallet to register as a voter
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Register as Voter</h1>
          <p className="text-muted-foreground">
            Join a zero-knowledge voting election on Solana
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 
                  ${currentStep >= step.id 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'border-muted-foreground text-muted-foreground'
                  }
                `}>
                  {currentStep > step.id ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`
                    w-16 h-0.5 mx-2
                    ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="mb-2" />
          <div className="text-center">
            <h3 className="font-semibold">{STEPS[currentStep - 1].title}</h3>
            <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                {/* Step 1: Wallet & Election Selection */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Wallet Connected</AlertTitle>
                      <AlertDescription>
                        Connected: {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Select Election</h3>
                      {isLoadingElections ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="ml-2">Loading elections...</span>
                        </div>
                      ) : availableElections.length === 0 ? (
                        <Alert variant="warning">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>No Elections Available</AlertTitle>
                          <AlertDescription>
                            There are currently no elections open for registration.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-3">
                          {availableElections.map((election) => (
                            <Card 
                              key={election.address}
                              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                                registrationData.electionName === election.name ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => handleElectionSelect(election.name)}
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="font-medium">{election.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Registration Open
                                    </p>
                                  </div>
                                  <Badge variant="secondary">Open</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Generate Secret Key */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Key className="h-12 w-12 mx-auto text-primary mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Generate Your Secret Key</h3>
                      <p className="text-muted-foreground">
                        Your secret key is used to generate zero-knowledge proofs for voting
                      </p>
                    </div>

                    {!registrationData.generatedSecret ? (
                      <div className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Important</AlertTitle>
                          <AlertDescription>
                            Your secret key will be generated locally and never sent to any server. 
                            You'll need this key to vote after registration closes.
                          </AlertDescription>
                        </Alert>

                        <Button
                          onClick={handleGenerateSecret}
                          disabled={isGeneratingSecret}
                          className="w-full"
                          size="lg"
                        >
                          {isGeneratingSecret ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating Secret Key...
                            </>
                          ) : (
                            <>
                              <Key className="h-4 w-4 mr-2" />
                              Generate Secret Key
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Secret Key Generated</AlertTitle>
                          <AlertDescription>
                            Your secret key has been generated successfully. Please copy and save it securely.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium">Your Secret Key (Hex)</label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowSecret(!showSecret)}
                            >
                              {showSecret ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Show
                                </>
                              )}
                            </Button>
                          </div>

                          <div className="relative">
                            <Input
                              value={showSecret ? getSecretKeyHex() : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                              readOnly
                              className="font-mono text-xs pr-10"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                              onClick={() => copyToClipboard(getSecretKeyHex())}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <Alert variant="warning">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Save Your Secret Key</AlertTitle>
                          <AlertDescription className="space-y-2">
                            <p>
                              <strong>Important:</strong> After registration closes, you'll need this secret key to obtain a ZK voucher for voting.
                            </p>
                            <p>
                              Copy and save this key in a secure location. You won't be able to recover it later.
                            </p>
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Generate Proof & Register */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Zap className="h-12 w-12 mx-auto text-primary mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Complete Registration</h3>
                      <p className="text-muted-foreground">
                        Generate your zero-knowledge proof and register as a voter
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Election</label>
                          <p className="text-sm text-muted-foreground">{registrationData.electionName}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Wallet</label>
                          <p className="text-sm text-muted-foreground">
                            {publicKey?.toBase58().slice(0, 12)}...
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Secret Key Status</label>
                        <p className="text-sm text-green-600">✓ Generated and ready</p>
                      </div>
                    </div>

                    {!zkProof && (
                      <Button
                        onClick={handleGenerateProof}
                        disabled={isGeneratingProof || !registrationData.generatedSecret}
                        className="w-full"
                        size="lg"
                      >
                        {isGeneratingProof ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Proof & Registering...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Generate Proof & Register
                          </>
                        )}
                      </Button>
                    )}

                    {zkProof && !registerVoter.data && (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Proof Generated Successfully</AlertTitle>
                          <AlertDescription>
                            Your zero-knowledge proof has been generated. Click below to complete registration.
                          </AlertDescription>
                        </Alert>

                        <Button
                          onClick={handleRegister}
                          disabled={registerVoter.isPending}
                          className="w-full"
                          size="lg"
                        >
                          {registerVoter.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Completing Registration...
                            </>
                          ) : (
                            'Complete Registration'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Success */}
                {currentStep === 4 && (
                  <div className="space-y-6 text-center">
                    <div>
                      <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                      <h3 className="text-2xl font-bold mb-2">Registration Complete!</h3>
                      <p className="text-muted-foreground">
                        You have successfully registered as a voter for "{registrationData.electionName}"
                      </p>
                    </div>

                    {registerVoter.data && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Transaction Signature</label>
                          <div className="flex items-center space-x-2 mt-1">
                            <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                              {registerVoter.data}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(registerVoter.data!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => window.open(`https://explorer.solana.com/tx/${registerVoter.data}?cluster=devnet`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View on Explorer
                        </Button>
                      </div>
                    )}

                    <div className="space-y-4">
                      <Alert>
                        <Key className="h-4 w-4" />
                        <AlertTitle>Remember Your Secret Key</AlertTitle>
                        <AlertDescription>
                          <strong>Secret Key:</strong> {getSecretKeyHex().slice(0, 16)}...
                          <br />
                          You'll need this to get your ZK voucher for voting once registration closes.
                        </AlertDescription>
                      </Alert>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>What's Next?</AlertTitle>
                        <AlertDescription>
                          <div className="space-y-1 mx-auto">
                            <p>1. Keep your secret key safe and secure</p>
                            <p>2. Wait for the registration period to close</p>
                            <p>3. Use your secret key to obtain a ZK voucher for voting</p>
                            <p>4. Participate in the election when voting opens</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep === 1 && (
                <Button 
                  onClick={nextStep}
                  disabled={!registrationData.electionName}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {currentStep === 2 && registrationData.generatedSecret && (
                <Button 
                  onClick={nextStep}
                >
                  Continue to Registration
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {currentStep === 4 && (
                <Button onClick={() => window.location.href = '/dashboard'}>
                  Go to Dashboard
                </Button>
              )}
            </div>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default function RegisterUI() {
  const { publicKey } = useWallet()

  if (!publicKey) {
    return <ConnectWallet />
  }

  return (
    <SidebarUI>
      <MainContent />
    </SidebarUI>
  )
}