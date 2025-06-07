import { NextRequest, NextResponse } from 'next/server'
import { parsePDF, compareClauses } from '@/lib/pdf-parser'
import { enhanceResultsWithAI } from '@/lib/ai-service'
import { compareClausesWithMistral } from '@/lib/ai-mistral'
import { compareClausesWithOpenAI } from '@/lib/ai-openai'

// Specify Node.js runtime
export const runtime = 'nodejs'

type ComparisonStatus = "Aligned" | "Partial" | "Non-Compliant" | "Missing"

const KEY_CLAUSE_TYPES = [
  'Termination',
  'Delivery Terms',
  'Payment Terms',
  'Confidentiality and IP',
  'Limitation of Liability'
]

function normalizeClauseType(type: string, content?: string): string {
  const t = (type + ' ' + (content || '')).toLowerCase()
  if (t.match(/termination|terminate|end of (agreement|contract)|expiry|expiration/)) return 'Termination'
  if (t.match(/delivery|deliverable|ship|transport|handover/)) return 'Delivery Terms'
  if (t.match(/payment|price|fee|cost|invoice|currency/)) return 'Payment Terms'
  if (t.match(/confidential|non-disclosure|nda|privacy|secret|intellectual property|ip|copyright|patent|trademark/)) return 'Confidentiality and IP'
  if (t.match(/liabilit(y|ies)|limitation of liability|liability cap|indemnif(y|ication)/)) return 'Limitation of Liability'
  return ''
}

export async function POST(request: NextRequest) {
  console.log('API route hit')
  try {
    const formData = await request.formData()
    if (!formData) {
      console.error('No form data received')
      return NextResponse.json({ error: 'No form data received' }, { status: 400 })
    }
    const clientFile = formData.get('clientFile') as File
    const vendorFile = formData.get('vendorFile') as File
    const model = (formData.get('model') as string)?.toLowerCase() || 'mistral'
    if (!clientFile || !vendorFile) {
      console.error('Missing files in request')
      return NextResponse.json({ error: 'Both client and vendor files are required' }, { status: 400 })
    }
    if (!clientFile.name.toLowerCase().endsWith('.pdf') || !vendorFile.name.toLowerCase().endsWith('.pdf')) {
      console.error('Invalid file type')
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }
    let clientBuffer, vendorBuffer
    try {
      clientBuffer = Buffer.from(await clientFile.arrayBuffer())
      vendorBuffer = Buffer.from(await vendorFile.arrayBuffer())
    } catch (e) {
      console.error('Error converting files to buffers:', e)
      return NextResponse.json({ error: 'Failed to read uploaded files' }, { status: 500 })
    }
    let clientClauses, vendorClauses
    try {
      clientClauses = await parsePDF(clientBuffer)
      vendorClauses = await parsePDF(vendorBuffer)
    } catch (e) {
      console.error('Error parsing PDFs:', e)
      return NextResponse.json({ error: 'Failed to parse one or both PDF files' }, { status: 500 })
    }
    if (!Array.isArray(clientClauses) || !Array.isArray(vendorClauses)) {
      console.error('PDF parsing did not return arrays')
      return NextResponse.json({ error: 'PDF parsing failed' }, { status: 500 })
    }
    // For each key clause type, concatenate all matching sections' content
    function extractFullClause(clauses: any[], clauseType: string) {
      const matching = clauses.filter(clause => normalizeClauseType(clause.type || '', clause.content) === clauseType)
      if (matching.length === 0) return null
      // Concatenate all content, separated by two newlines
      return matching.map(c => c.content).join('\n\n')
    }
    function getKeyClauses(clauses: any[]) {
      return KEY_CLAUSE_TYPES.map(clauseType => {
        const text = extractFullClause(clauses, clauseType)
        return { clauseType, text: text || '' }
      })
    }
    const clientKeyClauses = getKeyClauses(clientClauses)
    const vendorKeyClauses = getKeyClauses(vendorClauses)
    // AI comparison for all key clauses
    const aiComparisonResults = await Promise.all(
      clientKeyClauses.map(async (clientClause, idx) => {
        const vendorClause = vendorKeyClauses[idx]
        if (clientClause.text && vendorClause.text) {
          let aiRes
          if (model === 'openai') {
            aiRes = await compareClausesWithOpenAI({
              clauseType: clientClause.clauseType,
              clientText: clientClause.text,
              vendorText: vendorClause.text
            })
          } else {
            aiRes = await compareClausesWithMistral({
              clauseType: clientClause.clauseType,
              clientText: clientClause.text,
              vendorText: vendorClause.text
            })
          }
          return {
            clauseType: clientClause.clauseType,
            ...aiRes,
            clientClause: clientClause.text,
            vendorClause: vendorClause.text
          }
        } else {
          return {
            clauseType: clientClause.clauseType,
            summary: 'Clause not found in one or both contracts.',
            risk: 'UNKNOWN',
            recommendation: 'No recommendation available.',
            clientClause: clientClause.text || '',
            vendorClause: vendorClause.text || ''
          }
        }
      })
    )
    console.log('Returning key clauses:', { clientKeyClausesCount: clientKeyClauses.length, vendorKeyClausesCount: vendorKeyClauses.length, model })
    return NextResponse.json({ aiComparisonResults })
  } catch (error) {
    console.error('Error in API route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 