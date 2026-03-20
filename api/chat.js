const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  // CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // preflight 대응
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ answer: "Method Not Allowed" });
  }

  try {
    const { question = "", place = {}, history = [], systemPrompt = "" } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        answer: "OPENAI_API_KEY가 설정되지 않았어요."
      });
    }

    const prompt = `
너는 유초등 대상 관광 해설 AI야.
한국어로 쉽고 짧고 친절하게 설명해.

장소명: ${place?.name || ""}
설명: ${place?.description || ""}
추가 지시: ${systemPrompt || ""}

질문: ${question}
    `;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt
    });

    return res.status(200).json({
      answer: response.output_text || "답변을 불러오지 못했어요."
    });
  } catch (error) {
    console.error("chat.js error:", error);
    return res.status(500).json({
      answer: error?.message || "AI 연결 오류"
    });
  }
};
