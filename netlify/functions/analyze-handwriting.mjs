import { GoogleGenAI, Type } from '@google/genai'

const schema = {
  type: Type.OBJECT,
  properties: {
    recognizedText: { type: Type.STRING },
    overallConfidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          expected: { type: Type.STRING },
          recognized: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['match', 'mismatch', 'uncertain'] },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['expected', 'recognized', 'status', 'confidence'],
      },
    },
    feedback: { type: Type.STRING },
  },
  required: ['recognizedText', 'overallConfidence', 'characters', 'feedback'],
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 503 })
  }

  try {
    const { imageBase64, mimeType, expectedText } = await request.json()
    if (!imageBase64 || !expectedText) {
      return Response.json({ error: 'imageBase64 and expectedText are required.' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const prompt = `당신은 초등학생을 돕는 친절한 한글 손글씨 판독 도우미입니다.
사진 속 학생이 따라 쓴 목표 문장은 "${expectedText}"입니다.
사진의 실제 손글씨만 보고 목표 문장의 각 글자를 판독하세요.
읽기 어려우면 억지로 추측하지 말고 recognized를 "?"로, status를 uncertain으로 설정하세요.
feedback은 초등학생이 이해할 수 있는 긍정적인 한 문장으로 쓰세요. 외모나 능력을 평가하지 마세요.
반드시 제공된 JSON 스키마로만 응답하세요.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
          { text: prompt },
        ],
      }],
      config: { responseMimeType: 'application/json', responseSchema: schema },
    })

    return Response.json(JSON.parse(response.text))
  } catch (error) {
    console.error('Handwriting analysis failed', error)
    return Response.json({ error: '손글씨를 분석하지 못했어요. 사진을 다시 찍어 주세요.' }, { status: 500 })
  }
}
