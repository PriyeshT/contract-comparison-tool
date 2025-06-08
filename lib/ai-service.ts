import OpenAI from 'openai'
import { ComparisonResult } from './pdf-parser'
import natural from 'natural'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

interface Clause {
  title: string
  content: string
  type?: string
  risk?: 'low' | 'medium' | 'high'
  analysis?: string
}

// Initialize TF-IDF
const tfidf = new natural.TfIdf()

export async function analyzeClause(clause: string): Promise<{
  type: string
  risk: 'low' | 'medium' | 'high'
  analysis: string
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found. Using fallback analysis.')
      return {
        type: 'Unknown',
        risk: 'medium',
        analysis: 'AI analysis not available. Please set OPENAI_API_KEY in .env.local'
      }
    }

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
    if (!process.env.OPENAI_API_KEY) {
      return 'AI suggestions not available. Please set OPENAI_API_KEY in .env.local'
    }

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
    // Create a new TF-IDF instance for this comparison
    const tfidf = new natural.TfIdf()
    
    // Add both documents to TF-IDF
    tfidf.addDocument(text1)
    tfidf.addDocument(text2)
    
    // Get the terms from both documents
    const terms1 = new Set(text1.toLowerCase().split(/\W+/))
    const terms2 = new Set(text2.toLowerCase().split(/\W+/))
    
    // Calculate similarity using TF-IDF scores
    let similarity = 0
    let totalWeight = 0
    
    // Compare terms from both documents
    for (const term of new Set([...terms1, ...terms2])) {
      const scores = tfidf.tfidfs(term)
      if (scores[0] > 0 && scores[1] > 0) {
        similarity += Math.min(scores[0], scores[1])
        totalWeight += Math.max(scores[0], scores[1])
      }
    }
    
    // Normalize similarity score
    return totalWeight > 0 ? similarity / totalWeight : 0
  } catch (error) {
    console.error('Error calculating similarity:', error)
    return 0
  }
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

export async function enhanceResultsWithAI(results: ComparisonResult[]): Promise<ComparisonResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not found, skipping AI enhancement')
    return results
  }

  if (!Array.isArray(results)) {
    throw new TypeError('Expected results to be an array in enhanceResultsWithAI, but got: ' + typeof results)
  }

  try {
    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        if (result.status === 'Aligned') return result

        const prompt = `
          Analyze the following contract clauses and provide specific suggestions for alignment:
          
          Client Clause: ${result.clientClause}
          Vendor Clause: ${result.vendorClause}
          Current Status: ${result.status}
          
          Provide specific suggestions for how to modify the vendor clause to better align with the client's requirements.
          Focus on concrete, actionable changes.
        `

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a legal contract analysis expert. Provide specific, actionable suggestions for aligning contract clauses."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })

        const suggestion = completion.choices[0]?.message?.content || 'No specific suggestions available'
        
        return {
          ...result,
          suggestedFix: suggestion
        }
      })
    )

    return enhancedResults
  } catch (error) {
    console.error('Error enhancing results with AI:', error)
    return results
  }
} 