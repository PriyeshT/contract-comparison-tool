"use client"

import { useState } from "react"
import { Upload, FileText, ContrastIcon as Compare, CheckCircle, AlertTriangle, XCircle, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
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

export default function ContractComparisonTool() {
  const [clientFile, setClientFile] = useState<File | null>(null)
  const [vendorFile, setVendorFile] = useState<File | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (file: File, type: "client" | "vendor") => {
    if (type === "client") {
      setClientFile(file)
    } else {
      setVendorFile(file)
    }
    setError(null)
  }

  const handleCompare = async () => {
    if (!clientFile || !vendorFile) return

    setIsComparing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('clientFile', clientFile)
      formData.append('vendorFile', vendorFile)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to compare contracts')
      }

      const data = await response.json()
      setComparisonResults(data.results)
      setShowResults(true)
    } catch (error) {
      console.error('Error comparing contracts:', error)
      setError(error instanceof Error ? error.message : 'An error occurred while comparing contracts')
    } finally {
      setIsComparing(false)
    }
  }

  const getStatusBadge = (status: ComparisonResult["status"]) => {
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
            </CardContent>
          </Card>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center mb-12">
          <Button
            onClick={handleCompare}
            disabled={!clientFile || !vendorFile || isComparing}
            className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-6 text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-purple-900 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isComparing ? (
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

        {/* Results Placeholder or Actual Results */}
        {!showResults ? (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl">
            <CardContent className="py-16 text-center">
              <div className="text-gray-400 mb-4">
                <Compare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              </div>
              <p className="text-gray-600 text-lg font-light">Results will appear here after comparison is complete.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-gray-800 text-2xl font-bold">Comparison Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 bg-gray-50">
                      <TableHead className="font-bold text-gray-800 py-4 px-6">Clause Title</TableHead>
                      <TableHead className="font-bold text-gray-800 py-4 px-6">Client Clause</TableHead>
                      <TableHead className="font-bold text-gray-800 py-4 px-6">Vendor Clause</TableHead>
                      <TableHead className="font-bold text-gray-800 py-4 px-6">Status</TableHead>
                      <TableHead className="font-bold text-gray-800 py-4 px-6">Suggested Fix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonResults.map((result, index) => (
                      <TableRow key={index} className="border-gray-100 hover:bg-gray-50 transition-colors">
                        <TableCell className="font-semibold text-gray-800 py-4 px-6">{result.clauseTitle}</TableCell>
                        <TableCell className="text-gray-600 max-w-xs py-4 px-6 font-light">
                          <div className="truncate" title={result.clientClause}>
                            {result.clientClause}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 max-w-xs py-4 px-6 font-light">
                          <div className="truncate" title={result.vendorClause || "Not specified"}>
                            {result.vendorClause || "Not specified"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">{getStatusBadge(result.status)}</TableCell>
                        <TableCell className="text-gray-600 max-w-xs py-4 px-6 font-light">
                          {result.suggestedFix && (
                            <div className="truncate" title={result.suggestedFix}>
                              {result.suggestedFix}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Stats */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-green-200">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {comparisonResults.filter(r => r.status === "Aligned").length}
                    </div>
                    <div className="text-sm text-green-700 font-medium">Aligned</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-yellow-200">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {comparisonResults.filter(r => r.status === "Partial").length}
                    </div>
                    <div className="text-sm text-yellow-700 font-medium">Partial</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-red-200">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {comparisonResults.filter(r => r.status === "Non-Compliant").length}
                    </div>
                    <div className="text-sm text-red-700 font-medium">Non-Compliant</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="text-3xl font-bold text-gray-600 mb-1">
                      {comparisonResults.filter(r => r.status === "Missing").length}
                    </div>
                    <div className="text-sm text-gray-700 font-medium">Missing</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
