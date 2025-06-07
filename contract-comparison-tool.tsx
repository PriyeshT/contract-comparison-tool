"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, FileText, ContrastIcon as Compare, CheckCircle, AlertTriangle, XCircle, Ban, ChevronDown, ChevronUp, Info, Brain, Sparkles, Loader2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loading } from "@/components/ui/loading"
import ComparisonResults from '@/components/ComparisonResults'
import Image from 'next/image'

interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
}

interface KeyClause {
  clauseType: string
  text: string
}

interface AllClause {
  clauseType: string
  text: string
}

interface AIComparisonResult {
  clauseType: string
  summary: string
  risk: string
  recommendation: string
  clientClause?: string
  vendorClause?: string
}

const KEY_CLAUSE_TYPES: string[] = [
  'Termination',
  'Delivery Terms',
  'Payment Terms',
  'Confidentiality and IP',
  'Limitation of Liability'
]

const AI_MODELS = [
  { label: 'Mistral', value: 'mistral', logo: '/mistral-logo.png' },
  { label: 'OpenAI', value: 'openai', logo: '/openai-logo.png' }
]

// Add analysis steps
const ANALYSIS_STEPS = [
  { id: 1, message: "Reading contract documents...", progress: 20 },
  { id: 2, message: "Extracting key clauses...", progress: 40 },
  { id: 3, message: "Analyzing termination clauses...", progress: 60 },
  { id: 4, message: "Comparing payment terms...", progress: 70 },
  { id: 5, message: "Evaluating liability clauses...", progress: 80 },
  { id: 6, message: "Generating recommendations...", progress: 90 },
  { id: 7, message: "Finalizing analysis...", progress: 100 }
]

export default function ContractComparisonTool() {
  const [clientFile, setClientFile] = useState<File | null>(null)
  const [vendorFile, setVendorFile] = useState<File | null>(null)
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [clientKeyClauses, setClientKeyClauses] = useState<KeyClause[]>([])
  const [vendorKeyClauses, setVendorKeyClauses] = useState<KeyClause[]>([])
  const [aiComparisonResults, setAIComparisonResults] = useState<AIComparisonResult[]>([])
  const [openIndexes, setOpenIndexes] = useState<number[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('mistral')
  const [progress, setProgress] = useState(0)
  const [finalizing, setFinalizing] = useState(false)
  const [openSourceIndexes, setOpenSourceIndexes] = useState<number[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleFileUpload = useCallback((file: File, type: "client" | "vendor") => {
    if (!mounted) return

    if (type === "client") {
      setClientFile(file)
    } else {
      setVendorFile(file)
    }
    setError(null)
  }, [mounted])

  const handleAccordionToggle = (idx: number) => {
    setOpenIndexes((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const handleSourceToggle = (idx: number) => {
    setOpenSourceIndexes(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const handleCompare = useCallback(async () => {
    if (!mounted || !clientFile || !vendorFile) return
    setLoading(true)
    setError(null)
    setProgress(0)
    setFinalizing(false)

    let currentStep = 0
    const progressInterval = setInterval(() => {
      if (currentStep < ANALYSIS_STEPS.length) {
        setProgress(ANALYSIS_STEPS[currentStep].progress)
        currentStep++
      } else {
        clearInterval(progressInterval)
        setFinalizing(true)
      }
    }, 1000)

    try {
      const formData = new FormData()
      formData.append('clientFile', clientFile)
      formData.append('vendorFile', vendorFile)
      formData.append('model', selectedModel)
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        let errorMessage = 'Failed to compare contracts'
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } else {
          errorMessage = `Server error: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setAIComparisonResults(data.aiComparisonResults || [])
      setClientKeyClauses([])
      setVendorKeyClauses([])
      setResults([])
      setOpenIndexes([])
      setOpenSourceIndexes([])
      setProgress(100)
      setFinalizing(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred while comparing contracts')
      setFinalizing(false)
    } finally {
      setLoading(false)
      clearInterval(progressInterval)
    }
  }, [mounted, clientFile, vendorFile, selectedModel])

  const getStatusBadge = useCallback((status: ComparisonResult["status"]) => {
    const statusConfig = {
      Aligned: {
        icon: CheckCircle,
        variant: "default" as const,
        className: "bg-green-100 text-green-800 hover:bg-green-200",
      },
      Partial: {
        icon: AlertTriangle,
        variant: "secondary" as const,
        className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      },
      "Non-Compliant": {
        icon: XCircle,
        variant: "destructive" as const,
        className: "bg-red-100 text-red-800 hover:bg-red-200",
      },
      Missing: { icon: Ban, variant: "outline" as const, className: "bg-gray-100 text-gray-800 hover:bg-gray-200" },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`${config.className} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    )
  }, [])

  if (!mounted) {
    // Prevent hydration error by not rendering until mounted
    return null
  }

  // Compute risk counts
  const initialRiskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }
  const riskCounts = aiComparisonResults.reduce((acc, result) => {
    const riskMatch = (result.risk || '').match(/^(HIGH|MEDIUM|LOW)/i)
    const riskLevel = (riskMatch ? riskMatch[0].toUpperCase() : 'UNKNOWN') as keyof typeof initialRiskCounts
    acc[riskLevel] = (acc[riskLevel] || 0) + 1
    return acc
  }, { ...initialRiskCounts })

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif]">
      <div className="container mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-16">
          <div className="mb-4">
            <Image src="/kpmg-digital-village.png" alt="KPMG Digital Village Logo" width={120} height={120} className="rounded" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-2 tracking-tight text-center">Contract Comparison Tool</h1>
          <p className="text-gray-600 text-xl font-light max-w-2xl leading-relaxed text-center">
            Upload and compare contracts to identify key differences and compliance issues
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Client Upload */}
          <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4 bg-purple-600">
              <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                Client Terms and Conditions
                <span className="ml-2 group relative">
                  <Info className="w-4 h-4 text-white opacity-70 cursor-pointer" />
                  <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    PDF only. Max size: 10MB. Drag & drop or click to upload.
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-purple-400 hover:bg-purple-50/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[220px]"
                onClick={() => document.getElementById("client-upload")?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-purple-600') }}
                onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-purple-600') }}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type === 'application/pdf') handleFileUpload(file, "client");
                }}
              >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                {clientFile ? (
                  <div className="text-gray-800 flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-6 h-6 text-purple-600" />
                      <span className="font-semibold text-lg">{clientFile.name}</span>
                      <span className="text-xs text-gray-500">({(clientFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setClientFile(null); }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium"
                      >Remove</button>
                      <button
                        onClick={e => { e.stopPropagation(); document.getElementById("client-upload")?.click(); }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
                      >Replace</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600 flex flex-col items-center">
                    <p className="font-semibold text-lg mb-3">Drop your PDF here or click to browse</p>
                    <p className="text-sm text-gray-500 font-light">PDF only. Max size: 10MB</p>
                  </div>
                )}
                <input
                  id="client-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "client")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Vendor Upload */}
          <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4 bg-purple-600">
              <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                Vendor Contract
                <span className="ml-2 group relative">
                  <Info className="w-4 h-4 text-white opacity-70 cursor-pointer" />
                  <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    PDF only. Max size: 10MB. Drag & drop or click to upload.
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-purple-400 hover:bg-purple-50/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[220px]"
                onClick={() => document.getElementById("vendor-upload")?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-purple-600') }}
                onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-purple-600') }}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type === 'application/pdf') handleFileUpload(file, "vendor");
                }}
              >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                {vendorFile ? (
                  <div className="text-gray-800 flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-6 h-6 text-purple-600" />
                      <span className="font-semibold text-lg">{vendorFile.name}</span>
                      <span className="text-xs text-gray-500">({(vendorFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setVendorFile(null); }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium"
                      >Remove</button>
                      <button
                        onClick={e => { e.stopPropagation(); document.getElementById("vendor-upload")?.click(); }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
                      >Replace</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600 flex flex-col items-center">
                    <p className="font-semibold text-lg mb-3">Drop your PDF here or click to browse</p>
                    <p className="text-sm text-gray-500 font-light">PDF only. Max size: 10MB</p>
                  </div>
                )}
                <input
                  id="vendor-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "vendor")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compare Button and AI Model Toggle Group */}
        <div className="flex justify-center items-center gap-4 mb-12 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="inline-flex rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {AI_MODELS.map((model) => (
              <button
                key={model.value}
                className={`px-6 py-2 font-semibold focus:outline-none transition-all duration-300 flex items-center gap-2 
                  ${selectedModel === model.value 
                    ? 'bg-purple-700 text-white scale-105 shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-purple-50 hover:scale-105 hover:shadow-sm'
                  }`}
                onClick={() => setSelectedModel(model.value)}
                disabled={loading}
                aria-pressed={selectedModel === model.value}
              >
                <Image
                  src={model.logo}
                  alt={`${model.label} logo`}
                  width={20}
                  height={20}
                  className={`transition-transform duration-300 ${selectedModel === model.value ? 'brightness-0 invert scale-110' : 'hover:scale-110'}`}
                />
                <span className="transition-all duration-300">{model.label}</span>
              </button>
            ))}
          </div>
          <Button
            onClick={handleCompare}
            disabled={!clientFile || !vendorFile || loading}
            className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-6 text-lg font-semibold rounded-xl 
              hover:from-purple-700 hover:to-purple-900 transition-all duration-300 shadow-lg hover:shadow-xl 
              hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Comparing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Compare className="w-5 h-5" />
                Compare Contracts
              </div>
            )}
          </Button>
        </div>

        {/* Progress Bar and Steps */}
        {(loading || finalizing) && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {finalizing
                  ? <span className="flex items-center gap-2">Finalizing analysis, please wait... <Loader2 className="w-4 h-4 animate-spin text-purple-600" /></span>
                  : ANALYSIS_STEPS.find(step => step.progress >= progress)?.message || "Analyzing contracts..."}
              </span>
              <span className="text-sm font-medium text-gray-700">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 space-y-2">
              {ANALYSIS_STEPS.map((step) => (
                <div 
                  key={step.id}
                  className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${
                    progress >= step.progress ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    progress >= step.progress ? 'bg-purple-600' : 'bg-gray-300'
                  }`} />
                  <span className={progress >= step.progress ? 'text-gray-900' : 'text-gray-500'}>
                    {step.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contract Review Results Section */}
        {mounted && aiComparisonResults.length > 0 && (
          <div className="mt-12 w-full">
            <h2 className="text-3xl font-bold mb-6 text-purple-800 text-center">Contract Review Results</h2>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full">
                <span className="text-sm text-gray-600">AI Model:</span>
                <span className="font-semibold text-purple-700 flex items-center gap-2">
                  <Image
                    src={AI_MODELS.find(m => m.value === selectedModel)?.logo || ''}
                    alt="Model logo"
                    width={16}
                    height={16}
                    className="rounded-sm"
                  />
                  {AI_MODELS.find(m => m.value === selectedModel)?.label}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 text-red-700 font-semibold">
                <XCircle className="w-5 h-5" /> {riskCounts.HIGH} HIGH
              </div>
              <div className="flex items-center gap-2 text-yellow-700 font-semibold">
                <AlertTriangle className="w-5 h-5" /> {riskCounts.MEDIUM} MEDIUM
              </div>
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle className="w-5 h-5" /> {riskCounts.LOW} LOW
              </div>
              <div className="flex items-center gap-2 text-gray-500 font-semibold">
                <HelpCircle className="w-5 h-5" /> {riskCounts.UNKNOWN} UNKNOWN
              </div>
            </div>
            <div className="space-y-4 w-full px-0">
              {aiComparisonResults.map((result, idx) => {
                // Extract only the risk level (first word) for the badge
                const riskMatch = (result.risk || '').match(/^(HIGH|MEDIUM|LOW)/i)
                const riskLevel = riskMatch ? riskMatch[0].toUpperCase() : 'UNKNOWN'
                // If there is extra risk explanation, show it inside the accordion
                const riskExplanation = (result.risk || '').replace(/^(HIGH|MEDIUM|LOW)\s*[-—:]?\s*/i, "").trim()
                // Helper to render safely
                function renderTextOrObject(val: any) {
                  if (val && typeof val === 'object') {
                    // Render as pretty JSON or key-value pairs
                    return (
                      <pre className="bg-gray-50 rounded p-2 text-xs text-gray-700 overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>
                    )
                  }
                  return String(val)
                }
                // Choose icon for risk
                let RiskIcon = CheckCircle, riskIconColor = 'text-green-600'
                if (riskLevel === 'HIGH') { RiskIcon = XCircle; riskIconColor = 'text-red-600' }
                else if (riskLevel === 'MEDIUM') { RiskIcon = AlertTriangle; riskIconColor = 'text-yellow-600' }
                else if (riskLevel === 'UNKNOWN') { RiskIcon = HelpCircle; riskIconColor = 'text-gray-400' }
                const expanded = openIndexes.includes(idx)
                return (
                  <div 
                    key={result.clauseType} 
                    className="border border-gray-200 rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden w-full"
                  >
                    <button
                      className="w-full flex items-center justify-between px-6 py-4 text-lg font-semibold text-left focus:outline-none hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => handleAccordionToggle(idx)}
                      aria-expanded={expanded}
                    >
                      <span className="flex items-center gap-3">
                        <RiskIcon className={`w-5 h-5 ${riskIconColor}`} />
                        {result.clauseType}
                        {riskLevel && (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                            riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            riskLevel === 'LOW' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {riskLevel}
                          </span>
                        )}
                      </span>
                      <span className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
                        {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                      </span>
                    </button>
                    <div
                      className={`transition-all duration-500 ease-in-out overflow-hidden ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                      style={{ willChange: 'max-height, opacity' }}
                      aria-hidden={!expanded}
                    >
                      <div className="px-6 pb-6 flex flex-col gap-6">
                        {riskExplanation && (
                          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 flex items-start gap-3">
                            <span className="text-yellow-500 text-xl mt-1">⚠️</span>
                            <div>
                              <div className="font-bold text-yellow-800 mb-1">Risk Explanation</div>
                              <div className="text-yellow-900 text-sm leading-relaxed">{renderTextOrObject(riskExplanation)}</div>
                            </div>
                          </div>
                        )}
                        {result.summary && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
                            <span className="text-gray-400 text-xl mt-1">📄</span>
                            <div>
                              <div className="font-bold text-gray-700 mb-1">Summary:</div>
                              <div className="text-gray-800 text-sm leading-relaxed">
                                {renderTextOrObject(result.summary.replace(/^\s*(HIGH|MEDIUM|LOW)\s*[-—:]?\s*/i, ""))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-gray-700 block mb-2">Recommendation for Vendor:</span>
                          <div className="text-gray-900 whitespace-pre-line bg-purple-50 p-4 rounded-lg border border-purple-100">
                            {renderTextOrObject(result.recommendation)}
                          </div>
                        </div>
                        <div>
                          <button
                            className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:underline focus:outline-none mb-2"
                            onClick={() => handleSourceToggle(idx)}
                            aria-expanded={openSourceIndexes.includes(idx)}
                          >
                            <span className={`transition-transform duration-300 ${openSourceIndexes.includes(idx) ? 'rotate-180' : ''}`}>{openSourceIndexes.includes(idx) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                            View Source Clauses
                          </button>
                          <div
                            className={`transition-all duration-500 ease-in-out overflow-hidden ${openSourceIndexes.includes(idx) ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
                            style={{ willChange: 'max-height, opacity' }}
                            aria-hidden={!openSourceIndexes.includes(idx)}
                          >
                            {openSourceIndexes.includes(idx) && (
                              <div className="flex flex-col md:flex-row gap-4 mt-2">
                                <div className="flex-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">📄 Source &bull; Client Clause</span>
                                  <textarea
                                    readOnly
                                    value={result.clientClause || ''}
                                    className="w-full min-h-[80px] bg-gray-100 border border-gray-200 rounded p-2 font-mono text-xs text-gray-700 resize-none mb-2"
                                  />
                                </div>
                                <div className="flex-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">📄 Source &bull; Vendor Clause</span>
                                  <textarea
                                    readOnly
                                    value={result.vendorClause || ''}
                                    className="w-full min-h-[80px] bg-gray-100 border border-gray-200 rounded p-2 font-mono text-xs text-gray-700 resize-none mb-2"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
