# Deployment na Vercel

Este documento descreve como fazer o deployment da aplicação **Tripulantes** na Vercel.

## Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Repositório GitHub com o código do projeto
- Base de dados PostgreSQL (recomenda-se usar Vercel Postgres ou um serviço externo)

## Passos para Deployment

### 1. Preparar a Base de Dados

Antes de fazer o deployment, é necessário ter uma base de dados PostgreSQL disponível:

**Opção A: Usar Vercel Postgres (Recomendado)**
- Aceda ao dashboard da Vercel
- Vá para "Storage" → "Create Database"
- Selecione "Postgres"
- Copie a string de conexão (DATABASE_URL)

**Opção B: Usar um serviço externo (Neon, Supabase, etc.)**
- Crie uma base de dados PostgreSQL no serviço escolhido
- Copie a string de conexão (DATABASE_URL)

### 2. Fazer o Import do Repositório

1. Aceda a [vercel.com/new](https://vercel.com/new)
2. Selecione "Import Git Repository"
3. Cole o URL do repositório: `https://github.com/AFSantosPt/Tripulantes`
4. Clique em "Continue"

### 3. Configurar Variáveis de Ambiente

Na página de configuração do projeto, adicione as seguintes variáveis de ambiente:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `DATABASE_URL` | `postgresql://...` | String de conexão da base de dados PostgreSQL |
| `OPENAI_API_KEY` | `sk-...` | Chave de API da OpenAI (opcional, para funcionalidades de IA) |
| `PORT` | `3000` | Porta do servidor (deixe como padrão) |

### 4. Configurar Build Settings

- **Build Command**: `pnpm run build`
- **Output Directory**: `artifacts/crew-fleet-hub/.expo/web`
- **Install Command**: `pnpm install`

### 5. Fazer o Deploy

1. Clique em "Deploy"
2. Aguarde a conclusão do build (pode levar alguns minutos)
3. Após o sucesso, a aplicação estará disponível em `https://<seu-projeto>.vercel.app`

### 6. Executar Migrações de Base de Dados

Após o primeiro deploy, é necessário executar as migrações de base de dados:

```bash
# Localmente (para testes)
pnpm --filter @workspace/db run push

# Na Vercel (usando Vercel CLI)
vercel env pull
pnpm --filter @workspace/db run push
```

## Estrutura do Projeto

```
.
├── artifacts/
│   ├── api-server/          # Backend Express.js
│   ├── crew-fleet-hub/      # Frontend Expo React Native
│   └── mockup-sandbox/      # Componentes de UI
├── lib/
│   ├── api-client-react/    # Cliente API para React
│   ├── api-spec/            # Especificação OpenAPI
│   ├── api-zod/             # Schemas Zod para validação
│   └── db/                  # Configuração Drizzle ORM
├── scripts/                 # Scripts de utilidade
├── package.json             # Root workspace
├── pnpm-workspace.yaml      # Configuração do workspace
└── vercel.json              # Configuração da Vercel
```

## Variáveis de Ambiente Necessárias

### Backend (api-server)

- `DATABASE_URL`: String de conexão PostgreSQL
- `OPENAI_API_KEY`: Chave de API da OpenAI (opcional)
- `PORT`: Porta do servidor (padrão: 3000)

### Frontend (crew-fleet-hub)

- `EXPO_PUBLIC_DOMAIN`: Domínio da aplicação (será configurado automaticamente)
- `EXPO_PUBLIC_API_URL`: URL da API (será configurada automaticamente)

## Troubleshooting

### Erro: "DATABASE_URL not provided"

Certifique-se de que a variável `DATABASE_URL` está configurada nas variáveis de ambiente da Vercel.

### Erro: "Large files detected"

O projeto contém ficheiros grandes que excedem o limite do GitHub. Estes foram removidos durante a migração. Se precisar de ficheiros grandes, considere usar Git LFS.

### Erro: "Build failed"

Verifique os logs de build na Vercel. Os erros mais comuns são:
- Dependências não instaladas corretamente
- Variáveis de ambiente não configuradas
- Problemas com a base de dados

## Monitoramento

Após o deployment, pode monitorar a aplicação:

- **Logs**: Aceda a "Deployments" → "Logs" no dashboard da Vercel
- **Métricas**: Verifique "Analytics" para estatísticas de utilização
- **Alertas**: Configure alertas para falhas de deployment

## Atualizações

Para atualizar a aplicação:

1. Faça push das alterações para o repositório GitHub
2. A Vercel fará o redeploy automaticamente
3. Aguarde a conclusão do build

## Suporte

Para mais informações, consulte:
- [Documentação da Vercel](https://vercel.com/docs)
- [Documentação do Expo](https://docs.expo.dev)
- [Documentação do Express.js](https://expressjs.com)
- [Documentação do Drizzle ORM](https://orm.drizzle.team)
