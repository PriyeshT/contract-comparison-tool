import { pipeline } from '@xenova/transformers'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface Clause {
  title: string
  content: string
  type?: string
  risk?: 'low' | 'medium' | 'high'
  analysis?: string
}

interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
  risk?: 'low' | 'medium' | 'high'
  analysis?: string
}

// Initialize the text classification pipeline
let classifier: any = null
async function getClassifier() {
  if (!classifier) {
    classifier = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')
  }
  return classifier
}

// Initialize the text embedding pipeline
let embedder: any = null
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

export async function analyzeClause(clause: string): Promise<{
  type: string
  risk: 'low' | 'medium' | 'high'
  analysis: string
}> {
  try {
    // Use OpenAI to analyze the clause
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a legal contract analysis expert. Analyze the following contract clause and provide: 1) The type of clause (e.g., Payment Terms, Liability, Termination, etc.), 2) Risk level (low, medium, high), and 3) A brief analysis of potential issues or concerns."
        },
        {
          role: "user",
          content: clause
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    })

    const analysis = response.choices[0].message.content
    const lines = analysis?.split('\n') || []
    
    return {
      type: lines[0]?.replace('Type:', '').trim() || 'Unknown',
      risk: (lines[1]?.toLowerCase().includes('high') ? 'high' : 
             lines[1]?.toLowerCase().includes('medium') ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      analysis: lines[2]?.replace('Analysis:', '').trim() || ''
    }
  } catch (error) {
    console.error('Error analyzing clause:', error)
    return {
      type: 'Unknown',
      risk: 'low',
      analysis: 'Unable to analyze clause'
    }
  }
}

export async function generateSuggestedFix(clientClause: string, vendorClause: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a legal contract expert. Given a client's clause and a vendor's clause, provide a specific suggestion for how to modify the vendor's clause to better align with the client's requirements. Be specific and provide actual clause language that could be used."
        },
        {
          role: "user",
          content: `Client Clause: ${clientClause}\nVendor Clause: ${vendorClause}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    return response.choices[0].message.content || 'Unable to generate suggestion'
  } catch (error) {
    console.error('Error generating suggestion:', error)
    return 'Unable to generate suggestion'
  }
}

export async function calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
  try {
    const embedder = await getEmbedder()
    const output1 = await embedder(text1, { pooling: 'mean', normalize: true })
    const output2 = await embedder(text2, { pooling: 'mean', normalize: true })
    
    // Calculate cosine similarity
    const similarity = dotProduct(output1.data, output2.data)
    return similarity
  } catch (error) {
    console.error('Error calculating similarity:', error)
    return 0
  }
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0)
}

export async function enhanceComparisonResults(results: ComparisonResult[]): Promise<ComparisonResult[]> {
  const enhancedResults = await Promise.all(
    results.map(async (result) => {
      if (result.status === 'Non-Compliant' || result.status === 'Partial') {
        const analysis = await analyzeClause(result.vendorClause)
        const suggestedFix = await generateSuggestedFix(result.clientClause, result.vendorClause)
        
        return {
          ...result,
          risk: analysis.risk,
          analysis: analysis.analysis,
          suggestedFix: suggestedFix
        }
      }
      return result
    })
  )

  return enhancedResults
} 