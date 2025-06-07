"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, FileText, ContrastIcon as Compare, CheckCircle, AlertTriangle, XCircle, Ban, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loading } from "@/components/ui/loading"
import ComparisonResults from '@/components/ComparisonResults'

interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
}

interface TestResult {
  numberOfClauses: number
  clauses: Array<{ title: string; contentPreview: string }>
  fileInfo: {
    name: string
    size: number
    type: string
  }
}

interface TestResults {
  client?: TestResult
  vendor?: TestResult
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
}

const mockResults: ComparisonResult[] = [
  {
    clauseTitle: "Payment Terms",
    clientClause: "Payment due within 30 days of invoice date",
    vendorClause: "Payment due within 45 days of invoice date",
    status: "Partial",
    suggestedFix: "Negotiate payment terms to align with client's 30-day requirement",
  },
  {
    clauseTitle: "Liability Cap",
    clientClause: "Liability limited to contract value",
    vendorClause: "Liability limited to contract value",
    status: "Aligned",
  },
  {
    clauseTitle: "Termination Notice",
    clientClause: "30 days written notice required",
    vendorClause: "90 days written notice required",
    status: "Non-Compliant",
    suggestedFix: "Request vendor to reduce termination notice period to 30 days",
  },
  {
    clauseTitle: "Data Protection",
    clientClause: "GDPR compliance mandatory with data breach notification within 24 hours",
    vendorClause: "Standard data protection measures",
    status: "Non-Compliant",
    suggestedFix: "Require explicit GDPR compliance clause with 24-hour breach notification",
  },
  {
    clauseTitle: "Intellectual Property",
    clientClause: "Client retains all IP rights to deliverables",
    vendorClause: "",
    status: "Missing",
    suggestedFix: "Add clause ensuring client retains IP rights to all deliverables",
  },
  {
    clauseTitle: "Force Majeure",
    clientClause: "Standard force majeure clause including pandemic provisions",
    vendorClause: "Standard force majeure clause including pandemic provisions",
    status: "Aligned",
  },
]

const KEY_CLAUSE_TYPES: string[] = [
  'Termination',
  'Delivery Terms',
  'Payment Terms',
  'Confidentiality and IP',
  'Limitation of Liability'
]

const AI_MODELS = [
  { label: 'Mistral', value: 'mistral' },
  { label: 'OpenAI', value: 'openai' }
]

export default function ContractComparisonTool() {
  const [clientFile, setClientFile] = useState<File | null>(null)
  const [vendorFile, setVendorFile] = useState<File | null>(null)
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<TestResults>({})
  const [mounted, setMounted] = useState(false)
  const [clientKeyClauses, setClientKeyClauses] = useState<KeyClause[]>([])
  const [vendorKeyClauses, setVendorKeyClauses] = useState<KeyClause[]>([])
  const [aiComparisonResults, setAIComparisonResults] = useState<AIComparisonResult[]>([])
  const [openIndexes, setOpenIndexes] = useState<number[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('mistral')

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
    setTestResults(prev => ({ ...prev, [type]: undefined }))
  }, [mounted])

  const handleAccordionToggle = (idx: number) => {
    setOpenIndexes((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const handleCompare = useCallback(async () => {
    if (!mounted || !clientFile || !vendorFile) return
    setLoading(true)
    setError(null)
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred while comparing contracts')
    } finally {
      setLoading(false)
    }
  }, [mounted, clientFile, vendorFile, selectedModel])

  const testPDF = useCallback(async (file: File, type: 'client' | 'vendor') => {
    if (!mounted) return

    setError(null)
    setTestResults(prev => ({ ...prev, [type]: undefined }))
    const formData = new FormData()
    formData.append('file', file)

    try {
      console.log(`Testing ${type} PDF:`, file.name)
      const response = await fetch('/api/test-pdf', {
        method: 'POST',
        body: formData
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      // First check if the response is ok
      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        console.error('Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          contentType
        })
        
        // Try to get the error message from the response
        let errorMessage = `Server error: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        throw new Error(errorMessage)
      }

      // Then check content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid response type:', contentType)
        const text = await response.text()
        console.error('Response body:', text)
        throw new Error('Server returned invalid response format')
      }

      // Parse the response
      const data = await response.json()
      console.log('Response data:', data)
      
      if (!data.success) {
        console.error(`${type} PDF test failed:`, data)
        throw new Error(data.error || 'Failed to test PDF')
      }

      // Update state with the results
      console.log(`${type} PDF test results:`, data)
      setTestResults(prev => ({ 
        ...prev, 
        [type]: {
          numberOfClauses: data.numberOfClauses || 0,
          clauses: data.clauses || [],
          fileInfo: data.fileInfo
        }
      }))
    } catch (error) {
      console.error(`Error testing ${type} PDF:`, error)
      setError(error instanceof Error ? error.message : 'Failed to test PDF')
    }
  }, [mounted])

  const testAPI = async () => {
    try {
      console.log('Testing API route...')
      const response = await fetch('/api/test', {
        method: 'POST'
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Invalid response type:', contentType)
        console.error('Response body:', text)
        throw new Error('Server returned invalid response format')
      }

      const data = await response.json()
      console.log('Response data:', data)
    } catch (error) {
      console.error('Error testing API:', error)
      setError(error instanceof Error ? error.message : 'Failed to test API')
    }
  }

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

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif]">
      <div className="container mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 tracking-tight">Contract Comparison Tool</h1>
          <p className="text-gray-600 text-xl font-light max-w-2xl mx-auto leading-relaxed">
            Upload and compare contracts to identify key differences and compliance issues
          </p>
          <button
            onClick={testAPI}
            className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test API Route
          </button>
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
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-purple-400 hover:bg-purple-50/30 transition-all duration-300 cursor-pointer"
                onClick={() => document.getElementById("client-upload")?.click()}
              >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                {clientFile ? (
                  <div className="text-gray-800">
                    <p className="font-semibold text-lg mb-2">{clientFile.name}</p>
                    <p className="text-sm text-gray-500 font-light">Click to replace file</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        testPDF(clientFile, 'client')
                      }}
                      className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Test PDF Parsing
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p className="font-semibold text-lg mb-3">Drop your PDF here or click to browse</p>
                    <p className="text-sm text-gray-500 font-light">Supports PDF files up to 10MB</p>
                  </div>
                )}
                <input
                  id="client-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "client")}
                />
              </div>
              {testResults.client && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <h3 className="font-semibold">Test Results:</h3>
                  {testResults.client.fileInfo && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">File Information:</p>
                      <ul className="list-disc pl-5 text-sm">
                        <li>Name: {testResults.client.fileInfo.name}</li>
                        <li>Size: {(testResults.client.fileInfo.size / 1024).toFixed(2)} KB</li>
                        <li>Type: {testResults.client.fileInfo.type}</li>
                      </ul>
                    </div>
                  )}
                  {testResults.client.numberOfClauses > 0 && (
                    <>
                      <p>Number of clauses: {testResults.client.numberOfClauses}</p>
                      <div className="mt-2">
                        <h4 className="font-medium">Clauses found:</h4>
                        <ul className="list-disc pl-5">
                          {testResults.client.clauses.map((c, i) => (
                            <li key={i}>{c.title}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
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
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-purple-400 hover:bg-purple-50/30 transition-all duration-300 cursor-pointer"
                onClick={() => document.getElementById("vendor-upload")?.click()}
              >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                {vendorFile ? (
                  <div className="text-gray-800">
                    <p className="font-semibold text-lg mb-2">{vendorFile.name}</p>
                    <p className="text-sm text-gray-500 font-light">Click to replace file</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        testPDF(vendorFile, 'vendor')
                      }}
                      className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Test PDF Parsing
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p className="font-semibold text-lg mb-3">Drop your PDF here or click to browse</p>
                    <p className="text-sm text-gray-500 font-light">Supports PDF files up to 10MB</p>
                  </div>
                )}
                <input
                  id="vendor-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "vendor")}
                />
              </div>
              {testResults.vendor && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <h3 className="font-semibold">Test Results:</h3>
                  {testResults.vendor.fileInfo && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">File Information:</p>
                      <ul className="list-disc pl-5 text-sm">
                        <li>Name: {testResults.vendor.fileInfo.name}</li>
                        <li>Size: {(testResults.vendor.fileInfo.size / 1024).toFixed(2)} KB</li>
                        <li>Type: {testResults.vendor.fileInfo.type}</li>
                      </ul>
                    </div>
                  )}
                  {testResults.vendor.numberOfClauses > 0 && (
                    <>
                      <p>Number of clauses: {testResults.vendor.numberOfClauses}</p>
                      <div className="mt-2">
                        <h4 className="font-medium">Clauses found:</h4>
                        <ul className="list-disc pl-5">
                          {testResults.vendor.clauses.map((c, i) => (
                            <li key={i}>{c.title}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center mb-12">
          <Button
            onClick={handleCompare}
            disabled={!clientFile || !vendorFile || loading}
            className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-6 text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-purple-900 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* AI Model Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {AI_MODELS.map((model) => (
              <button
                key={model.value}
                className={`px-6 py-2 font-semibold focus:outline-none transition-colors duration-150 ${selectedModel === model.value ? 'bg-purple-700 text-white' : 'bg-white text-gray-700 hover:bg-purple-50'}`}
                onClick={() => setSelectedModel(model.value)}
                disabled={loading}
                aria-pressed={selectedModel === model.value}
              >
                {model.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contract Review Results Section */}
        {mounted && aiComparisonResults.length > 0 && (
          <div className="mt-12 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-purple-800 text-center">Contract Review Results</h2>
            <div className="text-center mb-4 text-sm text-gray-500">AI Model: <span className="font-semibold text-purple-700">{AI_MODELS.find(m => m.value === selectedModel)?.label}</span></div>
            <div className="space-y-4">
              {aiComparisonResults.map((result, idx) => (
                <div key={result.clauseType} className="border border-gray-200 rounded-xl bg-white shadow">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-lg font-semibold text-left focus:outline-none"
                    onClick={() => handleAccordionToggle(idx)}
                    aria-expanded={openIndexes.includes(idx)}
                  >
                    <span>{result.clauseType}</span>
                    {openIndexes.includes(idx) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {openIndexes.includes(idx) && (
                    <div className="px-6 pb-6">
                      <div className="mb-2">
                        <span className="font-semibold text-gray-700">Risk Level:</span>
                        <span className={`ml-2 font-bold ${result.risk === 'HIGH' ? 'text-red-600' : result.risk === 'MEDIUM' ? 'text-yellow-600' : result.risk === 'LOW' ? 'text-green-600' : 'text-gray-500'}`}>{result.risk}</span>
                      </div>
                      <div className="mb-2">
                        <span className="font-semibold text-gray-700">Recommendation for Vendor:</span>
                        <div className="ml-2 mt-1 text-gray-900 whitespace-pre-line">{result.recommendation}</div>
                      </div>
                      {result.summary && (
                        <div className="mt-4">
                          <span className="font-semibold text-gray-700">Summary:</span>
                          <div className="ml-2 mt-1 text-gray-800 whitespace-pre-line">{result.summary}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
