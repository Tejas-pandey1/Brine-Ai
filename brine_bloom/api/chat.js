
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Groq API key is not configured in Vercel."
    });
  }

  try {
    const body = req.body || {};

    if (!Array.isArray(body.messages)) {
      return res.status(400).json({
        error: "A messages array is required."
      });
    }

    // Only allow normal user/assistant messages.
    const messages = body.messages
      .filter(
        (m) =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string"
      )
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 2000)
      }));

    if (
      messages.length === 0 ||
      messages[messages.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        error: "Please send a valid question."
      });
    }

    const systemPrompt = `
You are the Brine Guide, the friendly food expert
for Brine & Bloom, a fictional international pickle brand.

Answer questions about pickles, ingredients, flavour
pairings, food history, vinegar pickling, and fermentation.
Be accurate, warm, concise, and conversational.

Vinegar pickling and natural salt fermentation are
different methods. Do not invent historical facts,
ingredients, health benefits, or brand claims.

Garden Dill, Golden Hour, and Firecracker are fictional
concept products, not verified real products.

Never claim pickles cure or prevent diseases.
For food preservation safety, recommend tested recipes
and reputable food-safety guidance. Do not invent
shelf-stable canning instructions.

For unrelated questions, politely guide the conversation
back to pickles and food.
`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ],
          temperature: 0.5,
          max_tokens: 600
        })
      }
    );

    if (!groqResponse.ok) {
      const details = await groqResponse.text();
      console.error("Groq API error:", details);

      return res.status(502).json({
        error: "The AI service couldn't answer just now. Please try again."
      });
    }

    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty reply."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat function error:", error);

    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
};
