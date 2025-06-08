import natural from 'natural'
import pdfParse from 'pdf-parse'
import OpenAI from 'openai'

const tokenizer = new natural.WordTokenizer()
const TfIdf = natural.TfIdf
const openai = new OpenAI()

interface Clause {
  sectionNumber: string
  sectionTitle: string
  content: string
  obligations: string[]
  type?: string
  risk?: 'low' | 'medium' | 'high'
}

export interface ComparisonResult {
  clauseTitle: string
  clientClause: string
  vendorClause: string
  status: "Aligned" | "Partial" | "Non-Compliant" | "Missing"
  suggestedFix?: string
  risk: 'low' | 'medium' | 'high'
  analysis?: string
  similarityScore?: number
  clauseType: string
  summary?: string
  recommendation?: string
}

// Text extraction using pdf-parse
export async function extractTextFromPDF(file: Buffer): Promise<string> {
  const data = await pdfParse(file);
  if (!data.text || data.text.trim().length === 0) {
    throw new Error('No readable text found in the PDF. Please ensure the PDF contains selectable text.');
  }
  return data.text;
}

// Section detection patterns
const sectionPatterns = [
  /^\d+\./,                    // 1.
  /^\d+\.\d+/,                // 1.1
  /^\d+\.\d+\.\d+/,           // 1.1.1
  /^[A-Z]\./,                 // A.
  /^[A-Z]\.\d+/,             // A.1
  /^\([a-z]\)/,              // (a)
  /^\([ivx]+\)/i,            // (iv)
  /^[IVX]+\./i               // IV.
];

// Sentence splitting patterns
const sentenceDelimiters = [
  /\.\s+(?=[A-Z])/,          // Period followed by capital letter
  /;\s+(?=[A-Z])/,           // Semicolon followed by capital letter
  /:\s+(?=[A-Z])/,           // Colon followed by capital letter
  /\.\s+(?=\d+\.)/,          // Period followed by section number
  /\.\s+(?=\([a-z]\))/,      // Period followed by subsection
];

// Title detection patterns
const titlePatterns = [
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/,  // Title Case
  /^[A-Z]+(?:\s+[A-Z]+)*/,            // ALL CAPS
  /^[A-Z][a-z]+(?:\s+[a-z]+)*/        // Sentence case
];

function classifyClauseType(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Payment related
  if (lowerText.includes('payment') || 
      lowerText.includes('price') || 
      lowerText.includes('fee') || 
      lowerText.includes('cost') || 
      lowerText.includes('invoice') ||
      lowerText.includes('currency')) {
    return 'Payment Terms';
  }
  
  // Delivery related
  if (lowerText.includes('delivery') || 
      lowerText.includes('ship') || 
      lowerText.includes('transport') || 
      lowerText.includes('handover') ||
      lowerText.includes('deliverable')) {
    return 'Delivery Terms';
  }
  
  // Risk and Liability
  if (lowerText.includes('risk') || 
      lowerText.includes('liability') || 
      lowerText.includes('indemnification') || 
      lowerText.includes('warranty') ||
      lowerText.includes('damage')) {
    return 'Risk and Liability';
  }
  
  // Acceptance
  if (lowerText.includes('acceptance') || 
      lowerText.includes('approval') || 
      lowerText.includes('inspection') || 
      lowerText.includes('review') ||
      lowerText.includes('verify')) {
    return 'Acceptance';
  }
  
  // Termination
  if (lowerText.includes('termination') || 
      lowerText.includes('terminate') || 
      lowerText.includes('end') || 
      lowerText.includes('expire') ||
      lowerText.includes('cancel')) {
    return 'Termination';
  }
  
  // Confidentiality
  if (lowerText.includes('confidential') || 
      lowerText.includes('non-disclosure') || 
      lowerText.includes('nda') || 
      lowerText.includes('privacy') ||
      lowerText.includes('secret')) {
    return 'Confidentiality';
  }
  
  // Intellectual Property
  if (lowerText.includes('intellectual property') || 
      lowerText.includes('ip') || 
      lowerText.includes('copyright') || 
      lowerText.includes('patent') ||
      lowerText.includes('trademark')) {
    return 'Intellectual Property';
  }
  
  // Service Level
  if (lowerText.includes('service level') || 
      lowerText.includes('sla') || 
      lowerText.includes('performance') || 
      lowerText.includes('uptime') ||
      lowerText.includes('availability')) {
    return 'Service Level';
  }
  
  // Data Protection
  if (lowerText.includes('data protection') || 
      lowerText.includes('gdpr') || 
      lowerText.includes('personal data') || 
      lowerText.includes('data privacy') ||
      lowerText.includes('data security')) {
    return 'Data Protection';
  }
  
  // Force Majeure
  if (lowerText.includes('force majeure') || 
      lowerText.includes('act of god') || 
      lowerText.includes('unforeseen') || 
      lowerText.includes('beyond control')) {
    return 'Force Majeure';
  }
  
  // Governing Law
  if (lowerText.includes('governing law') || 
      lowerText.includes('jurisdiction') || 
      lowerText.includes('venue') || 
      lowerText.includes('dispute resolution') ||
      lowerText.includes('arbitration')) {
    return 'Governing Law';
  }
  
  return 'General Terms';
}

function extractSectionTitle(text: string): string {
  // First try to find a title after the section number
  const afterNumber = text.replace(/^[\d\.\s\(\)IVX]+/i, '').trim();
  if (afterNumber) {
    // Look for the first line that could be a title
    const lines = afterNumber.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 0) {
        // Check if it looks like a title (not too long, starts with capital)
        if (trimmed.length < 100 && /^[A-Z]/.test(trimmed)) {
          return trimmed;
        }
      }
    }
  }
  
  // If no title found, try to extract one from the content
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length > 0) {
      // Look for title patterns
      for (const pattern of titlePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }
  }
  
  // If still no title, use the first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
  }
  
  return 'Untitled Section';
}

function splitIntoSections(text: string): { number: string; title: string; content: string }[] {
  const lines = text.split('\n');
  const sections: { number: string; title: string; content: string }[] = [];
  let currentSection: { number: string; title: string; content: string } | null = null;

  for (const line of lines) {
    // Check if line starts with a section number
    let sectionMatch = null;
    for (const pattern of sectionPatterns) {
      const match = line.match(pattern);
      if (match) {
        sectionMatch = match;
        break;
      }
    }

    if (sectionMatch) {
      // Save previous section if it exists
      if (currentSection) {
        sections.push(currentSection);
      }
      // Start new section
      currentSection = {
        number: sectionMatch[0],
        title: extractSectionTitle(line),
        content: line
      };
    } else if (currentSection) {
      // Add line to current section
      currentSection.content += '\n' + line;
    }
  }

  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function splitIntoObligations(text: string): string[] {
  let obligations = [text];
  
  // Split on each delimiter pattern
  for (const pattern of sentenceDelimiters) {
    obligations = obligations.flatMap(obligation => 
      obligation.split(pattern).map(s => s.trim()).filter(s => s.length > 0)
    );
  }

  // Further split on common list indicators
  obligations = obligations.flatMap(obligation => {
    if (obligation.match(/^[•\-\*]\s/)) {
      return obligation.split(/[•\-\*]\s/).map(s => s.trim()).filter(s => s.length > 0);
    }
    return [obligation];
  });

  return obligations;
}

export async function parsePDF(file: Buffer): Promise<Clause[]> {
  try {
    console.log('Starting PDF parsing...')
    console.log('Input buffer size:', file.length)
    const text = await extractTextFromPDF(file)
    console.log('Text extracted, length:', text.length)

    // Split into sections
    const sections = splitIntoSections(text)
    console.log('Number of sections found:', sections.length)

    // Convert sections to clauses
    const clauses: Clause[] = sections.map(section => {
      const obligations = splitIntoObligations(section.content);
      const type = classifyClauseType(section.content);
      
      return {
        sectionNumber: section.number,
        sectionTitle: section.title,
        content: section.content,
        obligations: obligations,
        type: type
      };
    });

    if (clauses.length === 0) {
      throw new Error('No sections found in the PDF. Please ensure the PDF contains numbered sections.')
    }

    console.log('Number of clauses extracted:', clauses.length)
    return clauses
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw error
  }
}

export async function compareClauses(clientClauses: Clause[], vendorClauses: Clause[]): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = []
  
  // First, ensure all clauses have types
  const typedClientClauses = clientClauses.map(clause => ({
    ...clause,
    type: clause.type || classifyClauseType(clause.content)
  }))
  
  const typedVendorClauses = vendorClauses.map(clause => ({
    ...clause,
    type: clause.type || classifyClauseType(clause.content)
  }))
  
  // Group clauses by type
  const clientClausesByType = groupClausesByType(typedClientClauses)
  const vendorClausesByType = groupClausesByType(typedVendorClauses)
  
  // Get all unique clause types
  const allTypes = new Set([
    ...Object.keys(clientClausesByType),
    ...Object.keys(vendorClausesByType)
  ])
  
  // Compare clauses of the same type
  for (const type of allTypes) {
    const clientTypeClauses = clientClausesByType[type] || []
    const vendorTypeClauses = vendorClausesByType[type] || []
    
    // For each client clause of this type
    for (const clientClause of clientTypeClauses) {
      if (vendorTypeClauses.length === 0) {
        // No matching vendor clauses of this type - HIGH risk
        results.push({
          clauseTitle: clientClause.sectionTitle,
          clientClause: clientClause.content,
          vendorClause: '',
          status: 'Missing',
          clauseType: type,
          risk: 'high',
          suggestedFix: `Add ${type} clause for "${clientClause.sectionTitle}"`,
          summary: `Missing ${type} clause in vendor contract. This represents a significant risk as the vendor contract does not address ${type.toLowerCase()} requirements.`,
          recommendation: `Request vendor to add a ${type} clause that aligns with client requirements. Consider this a critical negotiation point.`
        })
        continue
      }
      
      // Find best match using embeddings
      const bestMatch = await findBestMatchWithEmbeddings(clientClause, vendorTypeClauses)
      
      // Get GPT analysis
      const analysis = await analyzeClauseDifferences(clientClause, bestMatch.clause, type)
      
      // Determine status and risk based on similarity score and analysis
      const { status, risk } = determineStatusAndRisk(bestMatch.similarity, analysis)
      
      results.push({
        clauseTitle: clientClause.sectionTitle,
        clientClause: clientClause.content,
        vendorClause: bestMatch.clause.content,
        status,
        clauseType: type,
        similarityScore: bestMatch.similarity,
        risk,
        summary: analysis.summary,
        recommendation: analysis.recommendation,
        suggestedFix: status === 'Aligned' ? undefined : 
          `Review and align ${type} clause "${clientClause.sectionTitle}" with client requirements`
      })
    }
  }
  
  return results
}

function groupClausesByType(clauses: Clause[]): Record<string, Clause[]> {
  return clauses.reduce((groups, clause) => {
    const type = clause.type || 'General Terms'
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(clause)
    return groups
  }, {} as Record<string, Clause[]>)
}

async function findBestMatchWithEmbeddings(clientClause: Clause, vendorClauses: Clause[]): Promise<{ clause: Clause; similarity: number }> {
  // Create a new TF-IDF instance for this comparison
  const tfidf = new TfIdf()
  
  // Add client clause
  tfidf.addDocument(clientClause.content)
  
  let bestMatch: { clause: Clause; similarity: number } = {
    clause: vendorClauses[0],
    similarity: 0
  }
  
  // Compare with each vendor clause
  for (const vendorClause of vendorClauses) {
    // Add vendor clause to TF-IDF
    tfidf.addDocument(vendorClause.content)
    
    // Get the terms from both documents
    const terms1 = new Set(clientClause.content.toLowerCase().split(/\W+/))
    const terms2 = new Set(vendorClause.content.toLowerCase().split(/\W+/))
    
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
    const normalizedSimilarity = totalWeight > 0 ? similarity / totalWeight : 0
    
    if (normalizedSimilarity > bestMatch.similarity) {
      bestMatch = {
        clause: vendorClause,
        similarity: normalizedSimilarity
      }
    }
  }
  
  return bestMatch
}

async function analyzeClauseDifferences(clientClause: Clause, vendorClause: Clause, clauseType: string): Promise<{ summary: string; recommendation: string }> {
  const prompt = `
    Compare these two contract clauses and provide a detailed analysis:
    
    Client Clause (${clauseType}):
    ${clientClause.content}
    
    Vendor Clause (${clauseType}):
    ${vendorClause.content}
    
    Please provide:
    1. A concise summary of key differences
    2. Identification of any legal or operational risks
    3. Specific recommendations for alignment
    
    Format the response as JSON with two fields:
    {
      "summary": "Brief summary of differences and risks",
      "recommendation": "Specific action items to address gaps"
    }
  `

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a legal contract analyst specializing in identifying risks and providing actionable recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content in GPT response')
    }

    const analysis = JSON.parse(content)
    return {
      summary: analysis.summary || 'Unable to generate summary.',
      recommendation: analysis.recommendation || 'Please review the clauses manually.'
    }
  } catch (error) {
    console.error('Error getting GPT analysis:', error)
    return {
      summary: 'Unable to generate detailed analysis.',
      recommendation: 'Please review the clauses manually for differences.'
    }
  }
}

function determineStatusAndRisk(similarity: number, analysis: { summary: string; recommendation: string }): { status: "Aligned" | "Partial" | "Non-Compliant"; risk: 'low' | 'medium' | 'high' } {
  // Base status on similarity score
  let status: "Aligned" | "Partial" | "Non-Compliant"
  if (similarity >= 0.85) {
    status = "Aligned"
  } else if (similarity >= 0.65) {
    status = "Partial"
  } else {
    status = "Non-Compliant"
  }

  // Determine risk level based on status and analysis content
  let risk: 'low' | 'medium' | 'high' = 'low'
  
  if (status === "Non-Compliant") {
    risk = 'high'
  } else if (status === "Partial") {
    // Check analysis for risk indicators
    const lowerAnalysis = analysis.summary.toLowerCase()
    if (lowerAnalysis.includes('critical') || 
        lowerAnalysis.includes('significant') || 
        lowerAnalysis.includes('major') ||
        lowerAnalysis.includes('severe')) {
      risk = 'high'
    } else if (lowerAnalysis.includes('risk') || 
               lowerAnalysis.includes('concern') || 
               lowerAnalysis.includes('issue')) {
      risk = 'medium'
    }
  }

  return { status, risk }
}

function isAllCaps(line: string): boolean {
  const trimmed = line.trim();
  // At least 3 letters, mostly uppercase, and not just numbers/symbols
  return (
    trimmed.length > 3 &&
    /[A-Z]/.test(trimmed) &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed.replace(/[^A-Z]/g, ''))
  );
}
