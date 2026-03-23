const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      answer: "잘못된 요청이에요 🙏"
    });
  }

  try {
    const { question = "", place = {}, systemPrompt = "" } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        answer: "AI 설정이 아직 준비되지 않았어요 😢"
      });
    }

    const prompt = `
너는 어린이를 위한 관광 해설 AI야.
너의 이름은 춘천쌤
말투는 친절하고 재미있게, 초등학생도 이해할 수 있게 설명해.

조건:
- 너무 길지 않게 (2~4문장)
- 어려운 단어 쓰지 않기
- 친근한 말투 사용

장소명: ${place?.name || ""}
설명: ${place?.description || ""}
추가 지시: ${systemPrompt || ""}

질문: ${question}
    `.trim();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("OPENAI_TIMEOUT")), 12000)
    );

    const response = await Promise.race([
      client.responses.create({
        model: "gpt-5.4",
        input: prompt
      }),
      timeoutPromise
    ]);

    return res.status(200).json({
      answer: response.output_text || "음... 다시 한 번 물어봐 줄래? 😊"
    });

  } catch (error) {
    console.error("chat.js error:", error);

    let fallback = "지금은 AI가 잠깐 쉬고 있어요 😢 조금만 있다가 다시 물어봐 주세요!";

    if (error.message === "OPENAI_TIMEOUT") {
      fallback = "조금 느려요 😭 다시 한 번만 물어봐 주세요!";
    }

    return res.status(200).json({
      answer: fallback
    });
  }
};
