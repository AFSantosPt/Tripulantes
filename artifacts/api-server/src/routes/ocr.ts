import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const client = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

const SHARED_RULES = `
=== FORMATO 1 — Portal Carris (ecrã "Consultar Serviço") ===

  Consultar Serviço: 30/04/2026
  Serviço: C514
  Miraflores (Est.)          14:30
  Miraflores (Est.)          22:00
  Serviço de Viatura:        Tipo de Afetação:
  Glória/04                  Normal
  Obs: Serviço assegurado com autocarro mini KARSAN

Output correto:
  2026-04-30
  Serviço C514 - Glória/04 - Normal
  Miraflores (Est.) 14:30
  Miraflores (Est.) 22:00
  Obs: Serviço assegurado com autocarro mini KARSAN

=== FORMATO 2 — App Carris (ecrã "Consultar Serviço" com Serviço simples) ===

  Consultar Serviço: 07/05/...
  Serviço: Museu
  Sto. Amaro (Est.)          10:00
  Sto. Amaro (Est.)          18:00
  Serviço de Viatura:        Tipo de Afetação:
  /Museu#/Museu              Normal

Output correto (usa o ano corrente se truncado; código = nome do serviço; viatura = campo "Serviço de Viatura" sem caracteres especiais):
  2026-05-07
  Serviço Museu - Museu - Normal
  Sto. Amaro (Est.) 10:00
  Sto. Amaro (Est.) 18:00

=== FORMATO 3 — App Carris (ecrã "Detalhes do Serviço" com Etapas) ===

  Detalhes do Serviço
  Museu - 1ª Etapa
  Sto. Amaro (Est.)          10:00
  Sto. Amaro (Est.)          13:00
  Linha:                     Tipo:
  Serviço de Viatura:        Condução
  Museu
  Museu - 2ª Etapa
  Sto. Amaro (Est.)          14:00
  Sto. Amaro (Est.)          18:00
  Linha:                     Tipo:
  Serviço de Viatura:        Condução
  Museu

Output correto (uma entrada por etapa, com data da lista ou fallback para hoje; código = nome + etapa):
  Serviço Museu-1 - Museu - Normal
  Sto. Amaro (Est.) 10:00
  Sto. Amaro (Est.) 13:00

  Serviço Museu-2 - Museu - Normal
  Sto. Amaro (Est.) 14:00
  Sto. Amaro (Est.) 18:00

=== OUTPUT FORMAT (um bloco por serviço/etapa, separados por linha em branco) ===

  YYYY-MM-DD
  Serviço CODIGO - VIATURA - TIPO
  LOCAL_INICIO HH:MM
  LOCAL_FIM HH:MM
  Obs: TEXTO_OBS

=== REGRAS ===
- Data: converte DD/MM/YYYY → YYYY-MM-DD. Se a data aparecer truncada (ex: "07/05/..."), usa o ano corrente. Se não houver data em lado nenhum, omite a linha.
- CODIGO: código do serviço (ex: C514, 0115, Museu, Museu-1). Se não existir, omite.
- VIATURA: campo "Serviço de Viatura". Remove caracteres especiais iniciais (ex: "/Museu#/Museu" → "Museu"). Se não existir, omite.
- TIPO: campo "Tipo de Afetação" (ex: Normal, Normal FO, Extra Tipo 1, Extra Tipo 2). "Condução" e "Condução Normal" mapeiam para "Normal". "Normal FO" indica serviço em feriado. Se não existir, usa "Normal".
- LOCAL_INICIO: nome da paragem de início conforme aparece.
- LOCAL_FIM: nome da paragem de fim conforme aparece.
- HH:MM: formato 24h com zero à esquerda (ex: 06:30, 14:00).
- Quando há múltiplas etapas (1ª Etapa, 2ª Etapa, etc.), cria um bloco separado para cada etapa.
- Obs: inclui o texto da linha "Obs:" se existir. Se não existir, omite esta linha.
- Devolve APENAS os dados, sem explicações, sem cabeçalhos, sem texto adicional.
- Se não encontrares nenhum serviço reconhecível, devolve exatamente: SEM_DADOS`;

const SYSTEM_PROMPT_IMAGE = `És um assistente especializado em extrair dados de serviços de tripulantes de transportes públicos portugueses (Carris/Metro/CP/outros operadores).

Vais receber imagens de screenshots de apps ou portais de gestão de serviços.
${SHARED_RULES}`;

const SYSTEM_PROMPT_TEXT = `És um assistente especializado em extrair dados de serviços de tripulantes de transportes públicos portugueses (Carris/Metro/CP/outros operadores).

Vais receber texto copiado de apps ou portais de gestão de serviços. O texto pode ser irregular, com espaços, tabulações ou linhas em branco a mais. Normaliza-o e extrai os dados de serviço.
${SHARED_RULES}`;

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
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_IMAGE,
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
    req.log.error({ err }, "OCR image error");
    res.status(500).json({ error: "Erro ao processar imagem" });
  }
});

router.post("/ocr/shift/text", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: "Campo 'text' obrigatório" });
    return;
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_TEXT,
        },
        {
          role: "user",
          content: `Extrai todos os serviços/turnos do seguinte texto:\n\n${text}`,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!result || result === "SEM_DADOS") {
      res.json({ text: "", found: false });
      return;
    }

    res.json({ text: result, found: true });
  } catch (err: any) {
    req.log.error({ err }, "OCR text error");
    res.status(500).json({ error: "Erro ao processar texto" });
  }
});

export default router;
