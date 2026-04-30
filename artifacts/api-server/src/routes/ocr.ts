import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const client = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

const SYSTEM_PROMPT = `És um assistente especializado em extrair dados de serviços de tripulantes de transportes públicos portugueses (Carris/Metro/CP).

Vais receber imagens de screenshots do portal da Carris ou documentos similares.

=== FORMATO DO PORTAL CARRIS ===
O portal mostra os serviços assim:

  Consultar Serviço: 30/04/2026
  Serviço: C514
  Miraflores (Est.)          14:30
  Miraflores (Est.)          22:00
  Serviço de Viatura:        Tipo de Afetação:
  Glória/04                  Normal
  Obs: Serviço assegurado com autocarro mini KARSAN de Miraflores (Est.)

Para este exemplo, o output correto seria:
  2026-04-30
  Serviço C514 - Glória/04 - Normal
  Miraflores (Est.) 14:30
  Miraflores (Est.) 22:00
  Obs: Serviço assegurado com autocarro mini KARSAN de Miraflores (Est.)

=== OUTPUT FORMAT (um bloco por serviço, separados por linha em branco) ===

  YYYY-MM-DD
  Serviço CODIGO - VIATURA - TIPO
  LOCAL_INICIO HH:MM
  LOCAL_FIM HH:MM
  Obs: TEXTO_OBS

=== REGRAS ===
- Data: converte DD/MM/YYYY → YYYY-MM-DD. Se não houver data, omite essa linha.
- CODIGO: código do serviço (ex: C514, 0115, 303). Se não existir, omite.
- VIATURA: valor do campo "Serviço de Viatura" (ex: Glória/04, 15E/06). Se não existir, omite.
- TIPO: valor do campo "Tipo de Afetação" (ex: Normal, Normal FO, Extra Tipo 1, Extra Tipo 2). Se não existir, omite. "Normal FO" indica serviço em feriado.
- LOCAL_INICIO e LOCAL_FIM: nome das paragens/locais conforme aparecem na imagem.
- HH:MM: formato 24h com zero à esquerda (ex: 06:30, 14:00, 22:00).
- A primeira linha de horário (mais cedo) é o início; a segunda (mais tarde) é o fim.
- Obs: inclui o texto da linha "Obs:" se existir. Se não existir, omite esta linha.
- Devolve APENAS os dados, sem explicações, sem cabeçalhos, sem texto adicional.
- Se não encontrares nenhum serviço reconhecível, devolve exatamente: SEM_DADOS`;

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
      model: "gpt-4o-mini",
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
              text: "Extrai todos os serviços/turnos desta imagem seguindo o formato indicado.",
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
