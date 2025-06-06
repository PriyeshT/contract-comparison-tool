// Add type declaration for pdf-parse
declare module 'pdf-parse' {
  function parse(dataBuffer: Buffer): Promise<{
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }>;
  export = parse;
}

import pdfParse from 'pdf-parse'
import natural from 'natural'

const tokenizer = new natural.WordTokenizer()
const TfIdf = natural.TfIdf

interface Clause {
  title: string
  content: string
}

interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
}

export async function parsePDF(file: Buffer): Promise<Clause[]> {
  try {
    const data = await pdfParse(file)
    const text = data.text

    // Split text into potential clauses (this is a simple implementation)
    // In a real application, you'd want more sophisticated clause detection
    const lines = text.split('\n').filter((line: string) => line.trim().length > 0)
    const clauses: Clause[] = []
    let currentClause: Clause | null = null

    for (const line of lines) {
      // Simple heuristic: lines in ALL CAPS might be clause titles
      if (line === line.toUpperCase() && line.length > 3) {
        if (currentClause) {
          clauses.push(currentClause)
        }
        currentClause = {
          title: line,
          content: ''
        }
      } else if (currentClause) {
        currentClause.content += line + ' '
      }
    }

    if (currentClause) {
      clauses.push(currentClause)
    }

    return clauses
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw error
  }
}

export function compareClauses(clientClauses: Clause[], vendorClauses: Clause[]): ComparisonResult[] {
  const results: ComparisonResult[] = []
  const tfidf = new TfIdf()

  // Add all clauses to TF-IDF
  clientClauses.forEach(clause => {
    tfidf.addDocument(clause.content)
  })
  vendorClauses.forEach(clause => {
    tfidf.addDocument(clause.content)
  })

  // Compare each client clause with vendor clauses
  clientClauses.forEach(clientClause => {
    const bestMatch = findBestMatch(clientClause, vendorClauses, tfidf)
    results.push({
      clauseTitle: clientClause.title,
      clientClause: clientClause.content,
      vendorClause: bestMatch?.content || '',
      status: determineStatus(clientClause, bestMatch),
      suggestedFix: generateSuggestedFix(clientClause, bestMatch)
    })
  })

  return results
}

function findBestMatch(clientClause: Clause, vendorClauses: Clause[], tfidf: natural.TfIdf): Clause | null {
  let bestMatch: Clause | null = null
  let bestScore = 0

  vendorClauses.forEach(vendorClause => {
    const score = calculateSimilarity(clientClause.content, vendorClause.content)
    if (score > bestScore) {
      bestScore = score
      bestMatch = vendorClause
    }
  })

  return bestMatch
}

function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenizer.tokenize(text1.toLowerCase())
  const tokens2 = tokenizer.tokenize(text2.toLowerCase())
  
  if (!tokens1 || !tokens2) return 0

  const set1 = new Set(tokens1)
  const set2 = new Set(tokens2)
  
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return intersection.size / union.size
}

function determineStatus(clientClause: Clause, vendorClause: Clause | null): "Aligned" | "Partial" | "Non-Compliant" | "Missing" {
  if (!vendorClause) return "Missing"
  
  const similarity = calculateSimilarity(clientClause.content, vendorClause.content)
  
  if (similarity > 0.8) return "Aligned"
  if (similarity > 0.5) return "Partial"
  return "Non-Compliant"
}

function generateSuggestedFix(clientClause: Clause, vendorClause: Clause | null): string | undefined {
  if (!vendorClause) {
    return `Add clause for "${clientClause.title}"`
  }

  const similarity = calculateSimilarity(clientClause.content, vendorClause.content)
  if (similarity > 0.8) return undefined

  return `Review and align "${clientClause.title}" clause with client requirements`
} 