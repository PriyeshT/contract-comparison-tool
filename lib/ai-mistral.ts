import axios from 'axios'

const MISTRAL_API_URL = process.env.MISTRAL_API_URL || ''
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || ''

export async function compareClausesWithMistral({ clauseType, clientText, vendorText }: { clauseType: string, clientText: string, vendorText: string }) {
  const prompt = `You are a legal contract analyst always representing the client. Your recommendations should be what the vendor must do to meet the client's requirements.

Clause Type: "${clauseType}"

Compare the client's clause with the vendor's clause below. Your goal is to identify any misalignment, legal risk, or missing provisions.

Client Clause:
${clientText}

Vendor Clause:
${vendorText}

Please respond in the following structured JSON format:
{
  "summary": "[Brief comparison: highlight key similarities and differences]",
  "risk": "[HIGH, MEDIUM, LOW — from the client's perspective]",
  "recommendation": "[Actionable suggestion for the vendor to align or mitigate risk in favor of the client]"
}

Return only a valid JSON object and nothing else — no explanation, no markdown.`

  try {
    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: 'You are a legal contract expert.' },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    // Mistral returns { choices: [{ message: { content: ... } }] }
    let content = response.data.choices?.[0]?.message?.content
    if (!content) throw new Error('No content in Mistral response')
    content = content.trim()
    // Remove Markdown code block if present
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
    }
    const result = JSON.parse(content)
    return {
      summary: result.summary || '',
      risk: result.risk || '',
      recommendation: result.recommendation || ''
    }
  } catch (error) {
    console.error('Error calling Mistral AI:', error)
    return {
      summary: 'Unable to generate summary.',
      risk: 'UNKNOWN',
      recommendation: 'Unable to generate recommendation.'
    }
  }
} 