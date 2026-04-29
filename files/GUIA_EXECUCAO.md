# Guia de Execução — Ative+60 App

> Este é o seu mapa do tesouro. Siga as fases na ordem. Não pule.

---

## Visão Geral das Fases

```
FASE 0 — Preparação de contas (15 min)
   ↓
FASE 1 — Banco de dados Supabase (15 min)
   ↓
FASE 2 — Configuração do projeto local (10 min)
   ↓
FASE 3 — Construção com Claude Code (2-3h)
   ↓
FASE 4 — Iterações de polimento (1-2h)
   ↓
FASE 5 — Deploy na Vercel (15 min)
   ↓
FASE 6 — Validação e demonstração
```

**Tempo total estimado:** 4 a 6 horas de trabalho líquido, espalhado conforme sua agenda permitir.

---

## FASE 0 — Preparação de contas

Crie nesta ordem, todas com o mesmo e-mail de projeto que você vai criar:

### 0.1. Conta Supabase
1. Acesse [supabase.com](https://supabase.com) e clique em **Sign up**
2. Use **GitHub** ou e-mail
3. Crie um novo projeto:
   - **Nome:** `ative-mais-60-app`
   - **Database password:** **gere uma senha forte e SALVE em local seguro**. Você vai precisar dela.
   - **Region:** `South America (São Paulo)` — menor latência para João Pessoa
   - **Pricing plan:** Free (suficiente para o MVP)
4. Aguarde a criação (1-2 minutos)
5. Quando o projeto estiver pronto, vá em **Project Settings → API** e copie:
   - **Project URL** (`https://[xxx].supabase.co`)
   - **anon public key**
   - **service_role key** (secreta, nunca exponha no frontend)
6. **Salve essas três informações** num arquivo separado por enquanto

### 0.2. Conta Vercel
1. Acesse [vercel.com](https://vercel.com) e clique em **Sign up**
2. Use **GitHub** (recomendado, vai facilitar deploy depois)
3. Plano Hobby (gratuito) é suficiente

### 0.3. Conta GitHub (se ainda não tiver)
1. Acesse [github.com](https://github.com) e clique em **Sign up**
2. Crie repositório novo (ainda vazio):
   - **Nome:** `ative-mais-60-app`
   - **Visibilidade:** Private (importante, dados sensíveis)
   - Não inicialize com README, .gitignore, nem licença

---

## FASE 1 — Popular o banco de dados Supabase

### 1.1. Executar o schema SQL

1. No Supabase, abra o projeto recém-criado
2. Menu lateral esquerdo: **SQL Editor → New Query**
3. Abra o arquivo `SCHEMA_SUPABASE.sql` (que você recebeu)
4. **Copie todo o conteúdo** e cole no SQL Editor do Supabase
5. Clique **Run** (canto inferior direito)
6. Aguarde a execução (10-30 segundos para popular ~840 evoluções)
7. Verifique no menu **Table Editor** que as 7 tabelas existem com dados:
   - `profiles` com 6 linhas (Guilherme, Amanda, Rayanne, Ismênia, Líbia, Kívia)
   - `patients` com 28 linhas
   - `medications` com 70 a 100 linhas
   - `appointments` com cerca de 3.000 linhas (90 dias × média de 33 atendimentos por dia)
   - `evolutions` com cerca de 840 linhas
   - `exams` vazia (normal)
   - `monthly_reports` vazia (normal)

### 1.2. Criar usuários de autenticação

O SQL cria os **profiles**, mas você precisa criar os **usuários de login** manualmente.

1. No Supabase: **Authentication → Users → Add user → Create new user**
2. Crie cada um destes 6 usuários (use a mesma senha simples para demo, ex: `Ative60@2026`):

   | E-mail                         | Nome                | Função |
   | ------------------------------ | ------------------- | ------ |
   | `guilherme@somosdom.io`        | Guilherme Duarte    | gestao |
   | `amanda@ativemais60.com.br`    | Amanda Cardoso      | gestao |
   | `rayanne@ativemais60.com.br`   | Rayanne Paiva       | gestao |
   | `libia@ativemais60.com.br`     | Líbia               | fisio  |
   | `ismenia@ativemais60.com.br`   | Ismênia Pereira     | fisio  |
   | `kivia@ativemais60.com.br`     | Kívia               | fisio  |

   **Importante:** desmarque "Send email confirmation" para que os usuários fiquem ativos imediatamente.

3. Depois de criar todos os 6, volte ao **SQL Editor** e execute o script de vinculação que está **ao final do `SCHEMA_SUPABASE.sql`** (a última seção, comentada como "VINCULAÇÃO PROFILE × AUTH USER"). Esse script atualiza os IDs dos profiles para coincidir com os IDs dos auth.users criados.

### 1.3. Configurar Storage (para uploads de exames e fotos)

1. Menu lateral: **Storage → Create new bucket**
2. **Nome:** `paciente-arquivos`
3. **Public:** Não (privado, com RLS)
4. **File size limit:** 5MB
5. **Allowed MIME types:** `image/png, image/jpeg, application/pdf`
6. Clique **Create**
7. Repita para um segundo bucket: `relatorios-mensais` (mesmas configurações)

### 1.4. Validar que está tudo certo

Volte ao SQL Editor e rode esta query:

```sql
SELECT
  (SELECT COUNT(*) FROM profiles) AS profiles_count,
  (SELECT COUNT(*) FROM patients) AS patients_count,
  (SELECT COUNT(*) FROM evolutions) AS evolutions_count,
  (SELECT COUNT(*) FROM appointments WHERE status = 'completed') AS completed_appointments;
```

Você deve ver algo como:
```
profiles_count: 6
patients_count: 28
evolutions_count: 840-880
completed_appointments: 840-880
```

Se sim, **banco está pronto.**

---

## FASE 2 — Configurar projeto local

### 2.1. Instalar pré-requisitos

Você precisa ter instalado:
- **Node.js 20+** ([nodejs.org](https://nodejs.org/))
- **Git** ([git-scm.com](https://git-scm.com/))
- **Antigravity** com Claude Code habilitado

### 2.2. Criar pasta do projeto

```bash
mkdir ative-mais-60-app
cd ative-mais-60-app
```

### 2.3. Adicionar arquivos de contexto

Antes de iniciar o Claude Code, copie estes arquivos para a raiz do projeto:

```
ative-mais-60-app/
├── CONTEXT.md              ← do pacote que recebeu
├── PROMPT_INICIAL.md       ← do pacote que recebeu
├── PROMPTS_FOLLOWUP.md     ← do pacote que recebeu
├── SCHEMA_SUPABASE.sql     ← do pacote que recebeu (referência)
└── .env.local.example      ← você vai criar agora
```

### 2.4. Criar arquivo de variáveis de ambiente

Crie um arquivo chamado `.env.local` na raiz com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[seu-projeto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...sua-chave-service-role
```

Substitua pelos valores reais que você salvou na Fase 0.1.

**Importante:** crie também um `.gitignore` com no mínimo:
```
node_modules/
.next/
.env.local
.env
.DS_Store
```

---

## FASE 3 — Construção com Claude Code

### 3.1. Abrir o Antigravity no projeto

1. Abra o Antigravity
2. Abra a pasta `ative-mais-60-app/`
3. Inicie uma sessão Claude Code

### 3.2. Despachar o prompt inicial

1. Abra o arquivo `PROMPT_INICIAL.md` que você recebeu
2. Copie **todo o conteúdo**
3. Cole na primeira mensagem do Claude Code
4. Envie

O Claude Code vai:
- Ler o `CONTEXT.md` automaticamente (o prompt instrui)
- Inicializar projeto Next.js 15 com TypeScript
- Instalar todas as dependências necessárias
- Configurar Tailwind, shadcn/ui, paleta da Ative+60
- Criar estrutura de pastas
- Construir as 13 telas em fases incrementais
- Conectar com Supabase
- Implementar autenticação e RLS
- Construir geração de PDF do relatório mensal

**Tempo estimado:** 1.5 a 3 horas, dependendo da fase.

### 3.3. Acompanhamento durante a construção

Mantenha estas regras:

- **Não interrompa** o Claude Code no meio de uma fase. Deixe terminar a fase atual antes de pedir mudança.
- **Após cada fase**, abra o app no navegador (`npm run dev` em `http://localhost:3000`) e teste:
  - Login funciona?
  - Dashboard mostra dados?
  - Lista de pacientes carrega?
  - Etc.
- **Se algo estiver errado**, descreva precisamente: "no dashboard, o card de receita projetada está mostrando R$ 0, mas a query no Supabase retorna R$ 53.748. Qual o problema?"
- **Se o Claude Code propuser algo fora do escopo**, lembre-o: "está na seção 14 do CONTEXT.md, é v2".

---

## FASE 4 — Iterações de polimento

Use os 8 prompts do arquivo `PROMPTS_FOLLOWUP.md`, **um por vez**, na ordem sugerida. Cada um polide um aspecto específico:

1. Refinar identidade visual (paleta, espaçamentos, sombras)
2. Polir o layout do PDF do relatório mensal
3. Melhorar UX da tela de atendimento (mobile)
4. Adicionar animações sutis e transições
5. Implementar feedbacks visuais (toasts, loaders, estados vazios)
6. Refinar dashboard com microinterações nos KPIs
7. Otimizar performance (componentes server vs client)
8. Acessibilidade básica (foco visível, alt em imagens, ARIA)

---

## FASE 5 — Deploy na Vercel

### 5.1. Subir código para GitHub

```bash
git init
git add .
git commit -m "Inicial: Ative+60 App MVP"
git branch -M main
git remote add origin https://github.com/[seu-usuario]/ative-mais-60-app.git
git push -u origin main
```

### 5.2. Conectar Vercel ao GitHub

1. No Vercel: **Add New → Project → Import Git Repository**
2. Selecione `ative-mais-60-app`
3. **Framework preset:** Next.js (auto-detectado)
4. **Environment Variables:** adicione as 3 variáveis do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Clique **Deploy**

### 5.3. URL pública

Após 2-3 minutos, você terá uma URL tipo:
```
https://ative-mais-60-app.vercel.app
```

**Esta é a URL que você vai mostrar para Amanda e Rayanne.**

### 5.4. (Opcional) Configurar domínio próprio

Se quiser algo tipo `app.ativemais60.com.br`, configure no Vercel em **Settings → Domains**. Requer acesso ao DNS do domínio da Ative.

---

## FASE 6 — Validação e demonstração

### 6.1. Roteiro de validação técnica

Antes de mostrar para as sócias, faça este checklist:

- [ ] Login com `amanda@ativemais60.com.br` funciona e abre `/dashboard`
- [ ] Login com `rayanne@ativemais60.com.br` funciona e abre `/dashboard`
- [ ] Login com `kivia@ativemais60.com.br` funciona e abre `/agenda`
- [ ] Dashboard mostra KPIs com valores reais (cerca de R$ 53k receita projetada)
- [ ] Top pacientes do dashboard inclui Maria do C., Dione L., Vitória L.
- [ ] Lista de pacientes mostra 28 nomes
- [ ] Detalhe da Maria do C. mostra 11.8 anos de carteira
- [ ] Detalhe mostra histórico de evoluções dos últimos 30 dias
- [ ] Tela de atendimento funciona em celular (teste no seu iPhone/Android real)
- [ ] Relatório mensal gera PDF baixável
- [ ] PDF tem logo Ative+60 e rodapé com Amanda + Rayanne
- [ ] Kívia logada só vê Maria Aparecida
- [ ] Painel financeiro calcula corretamente

### 6.2. Apresentação para Amanda e Rayanne

**Não diga que é demonstração.** Apresente como produto.

1. Comece mostrando o **login** com o e-mail e a senha
2. **Dashboard** — "esse é o painel que vocês veem ao entrar"
3. **Detalhe de um paciente conhecido** (ex: Maria do C.) — "olhem o histórico real que está aqui"
4. **Geração do relatório mensal** — clique e mostre o PDF saindo formatado, com a marca delas
5. **Tela da fisioterapeuta** — abra no celular e mostre como Líbia/Ismênia/Kívia usariam em campo
6. **Painel financeiro** — receita do mês, repasses, etc

**O wow esperado:** elas devem dizer alguma versão de *"meu Deus, isso é o que a gente precisava"*.

### 6.3. Coletar feedback

Tenha papel e caneta (ou um doc aberto). Anote tudo que elas pedirem. Vire pauta da próxima iteração da DOM com elas.

---

## Apêndices

### A. Comandos úteis durante o desenvolvimento

```bash
npm run dev          # roda local em http://localhost:3000
npm run build        # build de produção (testa antes de deploy)
npm run lint         # checa erros
npx supabase db pull # baixa schema do supabase para tipo TypeScript
```

### B. Resolvendo problemas comuns

**"Failed to fetch from Supabase"**
- Variáveis de ambiente não foram carregadas. Reinicie `npm run dev` depois de criar `.env.local`.

**"Row Level Security blocked the request"**
- Está logado como usuário sem permissão para o que pediu. Verifique RLS no Supabase.

**"PDF não está gerando"**
- `@react-pdf/renderer` pode dar problema de SSR. Marque a página como `'use client'` ou crie API route.

**"Build da Vercel falhou"**
- Quase sempre é variável de ambiente faltando ou typo no código. Veja log completo.

### C. Custos esperados (gratuito para o MVP)

| Serviço  | Plano | Limite                                      | Custo |
| -------- | ----- | ------------------------------------------- | ----- |
| Supabase | Free  | 500MB DB, 1GB storage, 50k MAU              | R$ 0  |
| Vercel   | Hobby | 100GB bandwidth/mês                          | R$ 0  |
| GitHub   | Free  | Repos privados ilimitados                    | R$ 0  |

Para virar produto comercial mais robusto, planeje em torno de **$25 USD/mês Supabase Pro + $20 USD/mês Vercel Pro**, totalizando cerca de R$ 250/mês.

---

**Pronto.** Siga as fases. Pergunte ao Claude Code o que tiver dúvida durante a construção. Quando o app estiver no ar, me avise para a gente preparar a apresentação para a Amanda e Rayanne.

— DOM
