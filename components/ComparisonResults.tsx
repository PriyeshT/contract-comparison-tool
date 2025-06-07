"use client"

import { useState, useEffect } from 'react'
import { ComparisonResult } from '@/lib/pdf-parser'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, XCircle, Ban } from 'lucide-react'

interface ComparisonResultsProps {
  results: ComparisonResult[]
}

export default function ComparisonResults({ results }: ComparisonResultsProps) {
  const [mounted, setMounted] = useState(false)
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleClause = (clauseTitle: string) => {
    setExpandedClauses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clauseTitle)) {
        newSet.delete(clauseTitle)
      } else {
        newSet.add(clauseTitle)
      }
      return newSet
    })
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
      Missing: {
        icon: Ban,
        variant: "outline" as const,
        className: "bg-gray-100 text-gray-800 hover:bg-gray-200"
      },
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

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Comparison Results</h2>
      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleClause(result.clauseTitle)}
            >
              <h3 className="text-lg font-semibold text-gray-900">
                {result.clauseTitle}
              </h3>
              {getStatusBadge(result.status)}
            </div>
            {expandedClauses.has(result.clauseTitle) && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Client Clause</h4>
                  <p className="mt-1 text-gray-600">{result.clientClause}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Vendor Clause</h4>
                  <p className="mt-1 text-gray-600">
                    {result.vendorClause || "Not specified"}
                  </p>
                </div>
                {result.suggestedFix && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Suggested Fix</h4>
                    <p className="mt-1 text-gray-600">{result.suggestedFix}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 