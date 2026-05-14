# Tripulantes - Gestão de Frota e Serviços

**Tripulantes** é uma aplicação web e mobile para gestão completa de frotas de autocarros e elétricos, permitindo agendar serviços, contabilizar horas de trabalho, gerir trocas de serviços e reportar avarias.

## Funcionalidades Principais

- **Agendamento de Serviços**: Agende serviços com carreiras, chapas e horários específicos
- **Contabilização de Horas**: Registre e contabilize horas de trabalho e condução
- **Gestão de Trocas**: Facilite a troca de serviços entre tripulantes
- **Reportar Avarias**: Sistema centralizado para reportar avarias de elétricos e autocarros
- **Autenticação de Utilizadores**: Acesso seguro com autenticação de tripulantes
- **Dashboard em Tempo Real**: Visualize o estado de todos os serviços

## Stack Tecnológico

### Frontend
- **Framework**: Expo React Native com suporte web
- **UI**: Componentes customizados com TailwindCSS
- **Roteamento**: Expo Router
- **Estado**: React Query (TanStack Query)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Linguagem**: TypeScript
- **ORM**: Drizzle ORM
- **Banco de Dados**: PostgreSQL
- **Validação**: Zod
- **Logging**: Pino
- **IA**: Integração com OpenAI

### Infraestrutura
- **Monorepo**: pnpm workspaces
- **Build**: esbuild
- **Deployment**: Vercel
- **Versionamento**: Git

## Estrutura do Projeto

```
.
├── artifacts/
│   ├── api-server/              # Backend Express.js
│   │   ├── src/
│   │   │   ├── app.ts          # Configuração da aplicação
│   │   │   ├── index.ts        # Ponto de entrada
│   │   │   └── routes/         # Rotas da API
│   │   └── dist/               # Build compilado
│   ├── crew-fleet-hub/         # Frontend Expo React Native
│   │   ├── app/                # Rotas e páginas
│   │   ├── components/         # Componentes React
│   │   ├── contexts/           # Context API
│   │   └── hooks/              # Custom hooks
│   └── mockup-sandbox/         # Componentes de UI compartilhados
├── lib/
│   ├── api-client-react/       # Cliente HTTP para React
│   ├── api-spec/               # Especificação OpenAPI
│   ├── api-zod/                # Schemas Zod gerados
│   └── db/                     # Schema e configuração do BD
├── scripts/                    # Scripts de utilidade
├── package.json                # Root workspace
├── pnpm-workspace.yaml         # Configuração do workspace
├── vercel.json                 # Configuração da Vercel
├── DEPLOYMENT.md               # Guia de deployment
└── README.md                   # Este ficheiro
```

## Começar Localmente

### Pré-requisitos

- Node.js 24+
- pnpm 9+
- PostgreSQL 14+

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/AFSantosPt/Tripulantes.git
cd Tripulantes
```

2. Instale as dependências:
```bash
pnpm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
# Edite .env.local com suas configurações
```

4. Configure a base de dados:
```bash
# Crie as tabelas
pnpm --filter @workspace/db run push
```

5. Inicie o servidor de desenvolvimento:

**Backend:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Frontend (em outro terminal):**
```bash
pnpm --filter @workspace/crew-fleet-hub run dev
```

A aplicação estará disponível em `http://localhost:19000` (Expo) ou `http://localhost:3000` (web).

## Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm run build` | Build de toda a aplicação |
| `pnpm run typecheck` | Verificação de tipos TypeScript |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerar tipos da API a partir do OpenAPI |
| `pnpm --filter @workspace/db run push` | Aplicar migrações de BD |
| `pnpm --filter @workspace/api-server run dev` | Iniciar servidor de desenvolvimento |
| `pnpm --filter @workspace/crew-fleet-hub run dev` | Iniciar frontend de desenvolvimento |

## Deployment

Para fazer o deployment na Vercel, consulte o guia completo em [DEPLOYMENT.md](./DEPLOYMENT.md).

### Quick Deploy

```bash
# Instale a CLI da Vercel
npm install -g vercel

# Faça o deploy
vercel
```

## Variáveis de Ambiente

Consulte `.env.example` para ver todas as variáveis necessárias.

### Variáveis Críticas

- `DATABASE_URL`: String de conexão PostgreSQL (obrigatória)
- `OPENAI_API_KEY`: Chave de API da OpenAI (opcional)
- `PORT`: Porta do servidor (padrão: 3000)

## API Endpoints

A API está disponível em `/api` e segue a especificação OpenAPI definida em `lib/api-spec/openapi.yaml`.

### Autenticação

A aplicação usa autenticação baseada em sessão. Consulte a documentação da API para detalhes.

### Documentos Principais

- **Serviços**: `/api/services` - Gestão de serviços
- **Tripulantes**: `/api/crew` - Gestão de tripulantes
- **Avarias**: `/api/breakdowns` - Reportar e gerir avarias
- **Horas**: `/api/hours` - Contabilização de horas

## Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/sua-feature`
2. Commit suas alterações: `git commit -am 'Adicione sua feature'`
3. Push para a branch: `git push origin feature/sua-feature`
4. Abra um Pull Request

## Licença

Este projeto está licenciado sob a Licença MIT - veja o ficheiro LICENSE para detalhes.

## Suporte

Para suporte, abra uma issue no repositório GitHub ou contacte a equipa de desenvolvimento.

## Roadmap

- [ ] Integração com GPS em tempo real
- [ ] Notificações push
- [ ] Relatórios avançados
- [ ] Integração com sistemas de pagamento
- [ ] App nativa iOS/Android

## Changelog

### v1.0.0 (Inicial)
- Agendamento de serviços
- Contabilização de horas
- Gestão de trocas
- Sistema de reportar avarias
- Autenticação de utilizadores
