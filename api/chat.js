const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(place, customSystemPrompt = "") {
  const basePrompt = `
너는 "고춘천" 서비스 안에서 동작하는 유초등 대상 관광 해설 AI야.

역할:
- 아이 눈높이에 맞게 쉽고 친절하게 설명해.
- 너무 길지 않게 답해. 기본은 3~5문장 정도.
- 부모님이나 선생님이 함께 볼 수 있도록 교육 포인트도 짧게 알려줘.
- 장소 정보에 없는 내용은 추측해서 단정하지 말고, 아는 범위 안에서만 말해.
- 답변은 항상 한국어로 해.

현재 관광지 정보:
- 이름: ${place?.name || ""}
- 한글명: ${place?.title_ko || ""}
- 영문명: ${place?.title_en || ""}
- 카테고리: ${place?.category || ""}
- 설명: ${place?.description || ""}
- 주소: ${place?.address || ""}
- 찾아가는 길: ${place?.directions || ""}
- 공식 URL: ${place?.official_url || ""}
- 학습 포인트: ${place?.learning || ""}
`.trim();

  return [basePrompt, customSystemPrompt].filter(Boolean).join("\n\n");
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item.content === "string" && item.content.trim())
    .slice(-10)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content.trim(),
    }));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ answer: "Method Not Allowed" });
  }

  try {
    const {
      place = {},
      question = "",
      history = [],
      systemPrompt = "",
    } = req.body || {};

    const userQuestion = String(question || "").trim();

    if (!userQuestion) {
      return res.status(400).json({
        answer: "질문 내용이 비어 있어요.",
      });
    }

    const finalSystemPrompt = buildSystemPrompt(place, systemPrompt);
    const normalizedHistory = normalizeHistory(history);

    const input = [
      { role: "system", content: finalSystemPrompt },
      ...normalizedHistory,
      { role: "user", content: userQuestion },
    ];

    const response = await client.responses.create({
      model: "gpt-5.4",
      input,
    });

    const answer = (response.output_text || "").trim();

    return res.status(200).json({
      answer: answer || "답변을 불러오지 못했어요.",
    });
  } catch (error) {
    console.error("OpenAI API 오류:", error);
    return res.status(500).json({
      answer: "지금은 AI 연결이 잠시 불안정해요. 잠깐 후에 다시 물어봐 주세요.",
    });
  }
};