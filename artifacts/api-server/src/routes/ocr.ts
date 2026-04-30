import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const client = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

const SYSTEM_PROMPT = `És um assistente especializado em extrair dados de horários de serviços de tripulantes de transportes públicos portugueses (Carris/Metro/CP).

Quando receberes uma imagem de um screenshot ou documento com serviços/turnos, extrai TODOS os serviços visíveis e devolve-os neste formato exato (um bloco por serviço, separados por linha em branco):

YYYY-MM-DD
Serviço CODIGO - VIATURA - TIPO
LOCAL_INICIO HH:MM
LOCAL_FIM HH:MM

Regras:
- Se a data não estiver visível, omite essa linha (não inventes)
- CODIGO é o número do serviço (ex: 0115, 303, etc.) - se não existir, omite
- VIATURA é o código de viatura (ex: 15E/06) - se não existir, omite
- TIPO pode ser Normal, Extra Tipo 1, Extra Tipo 2 - se não reconheceres, usa Normal
- HH:MM no formato 24h com leading zero (ex: 06:30, 14:00)
- LOCAL_INICIO e LOCAL_FIM são os nomes das paragens/locais

Devolve APENAS os dados extraídos, sem explicações, sem cabeçalhos, sem texto adicional.
Se não encontrares nenhum serviço reconhecível, devolve exatamente: SEM_DADOS`;

router.post("/ocr/shift", async (req, res) => {
  const { image, mimeType } = req.body as {
    image?: string;
    mimeType?: string;
  };

  if (!image) {
    res.status(400).json({ error: "Campo 'image' em base64 obrigatório" });
    return;
  }

  const mime = (mimeType ?? "image/jpeg").replace(/[^a-z/]/g, "");

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Extrai todos os serviços/turnos desta imagem.",
            },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!text || text === "SEM_DADOS") {
      res.json({ text: "", found: false });
      return;
    }

    res.json({ text, found: true });
  } catch (err: any) {
    req.log.error({ err }, "OCR error");
    res.status(500).json({ error: "Erro ao processar imagem" });
  }
});

export default router;
