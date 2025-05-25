'use client'

import { useState } from 'react'
import { redirect, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Plus, X, ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { useNewElection, type ElectionFormData } from './new-election-data-access'
import { WalletButton } from '../solana/solana-provider'
import { useWallet } from '@solana/wallet-adapter-react'
import { SidebarUI } from '../sidebar/sidebar-ui'

// Form validation schema
const electionSchema = z.object({
  name: z.string()
    .min(1, 'Election name is required')
    .max(32, 'Election name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9\s-_]+$/, 'Only letters, numbers, spaces, hyphens, and underscores allowed'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less'),
  options: z.array(z.string().min(1, 'Option cannot be empty').max(20, 'Option must be 20 characters or less'))
    .min(2, 'At least 2 options are required')
    .max(20, 'Maximum 20 options allowed')
})

type FormData = z.infer<typeof electionSchema>

const STEPS = [
  {
    id: 1,
    title: 'Basic Information',
    description: 'Set up your election name and description'
  },
  {
    id: 2,
    title: 'Voting Options',
    description: 'Add the options voters can choose from'
  },
  {
    id: 3,
    title: 'Review & Create',
    description: 'Review your election details and create'
  }
]

function MainContent() {
  const { connected } = useWallet()
  const { createElection, checkNameAvailability } = useNewElection()
  const [currentStep, setCurrentStep] = useState(1)
  const [newOption, setNewOption] = useState('')

  const form = useForm<FormData>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      name: '',
      description: '',
      options: ['', '']
    }
  })

  const { watch, setValue, getValues } = form
  const watchedOptions = watch('options')
  const watchedName = watch('name')

  // Check name availability when name changes
  const handleNameCheck = async () => {
    if (watchedName && watchedName.length > 0) {
      try {
        const isAvailable = await checkNameAvailability.mutateAsync(watchedName)
        if (!isAvailable) {
          form.setError('name', { message: 'This election name is already taken' })
        }
      } catch (error) {
        console.error('Error checking name:', error)
      }
    }
  }

  const addOption = () => {
    if (newOption.trim() && watchedOptions.length < 20) {
      const currentOptions = getValues('options')
      setValue('options', [...currentOptions, newOption.trim()])
      setNewOption('')
    }
  }

  const removeOption = (index: number) => {
    const currentOptions = getValues('options')
    if (currentOptions.length > 2) {
      setValue('options', currentOptions.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const currentOptions = getValues('options')
    const newOptions = [...currentOptions]
    newOptions[index] = value
    setValue('options', newOptions)
  }

  const nextStep = async () => {
    let isValid = false
    
    if (currentStep === 1) {
      isValid = await form.trigger(['name', 'description'])
      if (isValid && watchedName) {
        await handleNameCheck()
        isValid = !form.formState.errors.name
      }
    } else if (currentStep === 2) {
      isValid = await form.trigger(['options'])
    }
    
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const formData: ElectionFormData = {
        name: data.name,
        description: data.description,
        options: data.options.filter(option => option.trim() !== '')
      }
      
      await createElection.mutateAsync(formData)
      redirect('/dashboard')
    } catch (error) {
      console.error('Failed to create election:', error)
    }
  }

  const progress = (currentStep / STEPS.length) * 100

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Wallet Required
            </CardTitle>
            <CardDescription>
              Please connect your wallet to create a new election
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
          <h1 className="text-3xl font-bold mb-2">Create New Election</h1>
          <p className="text-muted-foreground">
            Set up a new zero-knowledge voting election on Solana
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {STEPS.map((step) => (
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
                {step.id < STEPS.length && (
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Election Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter election name" 
                              {...field}
                              onBlur={() => handleNameCheck()}
                            />
                          </FormControl>
                          <FormDescription>
                            A unique name for your election (1-32 characters)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe what this election is about..."
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide details about the election (10-500 characters)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Voting Options */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Voting Options</h3>
                      <div className="space-y-3">
                        {watchedOptions.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1"
                            />
                            {watchedOptions.length > 2 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeOption(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {watchedOptions.length < 20 && (
                      <div className="flex gap-2">
                        <Input
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          placeholder="Add new option"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                        />
                        <Button type="button" onClick={addOption} disabled={!newOption.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                      {watchedOptions.length}/20 options • Minimum 2 required
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Review Election Details</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Election Name</h4>
                        <p className="text-muted-foreground">{watchedName}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Description</h4>
                        <p className="text-muted-foreground">{watch('description')}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Voting Options ({watchedOptions.filter(o => o.trim()).length})</h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {watchedOptions.filter(option => option.trim()).map((option, index) => (
                            <Badge key={index} variant="secondary">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < 3 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={createElection.isPending}
                  className="min-w-[120px]"
                >
                  {createElection.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Election'
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default function NewElectionUI() {
  return <SidebarUI><MainContent /></SidebarUI>
}