import { NextRequest, NextResponse } from 'next/server'
import { parsePDF, compareClauses } from '@/lib/pdf-parser'
import { enhanceComparisonResults, calculateSemanticSimilarity } from '@/lib/ai-service'

type ComparisonStatus = "Aligned" | "Partial" | "Non-Compliant" | "Missing"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const clientFile = formData.get('clientFile') as File
    const vendorFile = formData.get('vendorFile') as File

    if (!clientFile || !vendorFile) {
      return NextResponse.json(
        { error: 'Both client and vendor files are required' },
        { status: 400 }
      )
    }

    // Validate file types
    if (!clientFile.type.includes('pdf') || !vendorFile.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Convert Files to Buffers
    const clientBuffer = Buffer.from(await clientFile.arrayBuffer())
    const vendorBuffer = Buffer.from(await vendorFile.arrayBuffer())

    // Parse PDFs
    const clientClauses = await parsePDF(clientBuffer)
    const vendorClauses = await parsePDF(vendorBuffer)

    // Compare clauses using semantic similarity
    const comparisonResults = await Promise.all(
      clientClauses.map(async (clientClause) => {
        let bestMatch = null
        let bestScore = 0

        for (const vendorClause of vendorClauses) {
          const similarity = await calculateSemanticSimilarity(
            clientClause.content,
            vendorClause.content
          )
          if (similarity > bestScore) {
            bestScore = similarity
            bestMatch = vendorClause
          }
        }

        const status: ComparisonStatus = bestScore > 0.8 ? 'Aligned' : 
                                       bestScore > 0.5 ? 'Partial' : 
                                       bestMatch ? 'Non-Compliant' : 'Missing'

        return {
          clauseTitle: clientClause.title,
          clientClause: clientClause.content,
          vendorClause: bestMatch?.content || '',
          status
        }
      })
    )

    // Enhance results with AI analysis
    const enhancedResults = await enhanceComparisonResults(comparisonResults)

    return NextResponse.json({
      message: 'Files processed successfully',
      results: enhancedResults
    })
  } catch (error) {
    console.error('Error processing file upload:', error)
    return NextResponse.json(
      { error: 'Error processing file upload' },
      { status: 500 }
    )
  }
} 