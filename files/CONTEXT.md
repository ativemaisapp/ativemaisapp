# CONTEXT.md — Ative+60 App

> **Documento de contexto técnico do projeto.** Lido pelo Claude Code antes de qualquer ação. Define identidade, escopo, regras de negócio e padrões.

---

## 1. Visão geral do produto

O **Ative+60 App** é o sistema operacional interno da **Ative Mais 60**, empresa de fisioterapia domiciliar especializada em pacientes 60+ em João Pessoa-PB.

Resolve quatro dores estruturais do negócio:

1. **Operação invisível em campo** — fisioterapeutas atendem em casa de paciente, evolução fica em papel, gestão não tem visibilidade do que acontece
2. **Relacionamento fragilizado com famílias** — contato é quase 100% financeiro, sem demonstração estruturada de valor
3. **Gestão sem painel** — controle de carteira, receita e produção feito em planilha Excel manual
4. **Entrada de paciente sem sistema** — anamnese em papel, dados clínicos perdidos no fluxo

---

## 2. Stack obrigatório

- **Framework:** Next.js 15 com App Router e TypeScript
- **Estilo:** Tailwind CSS + shadcn/ui (componentes)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Row Level Security)
- **PDF:** `@react-pdf/renderer` para gerar relatórios
- **Gráficos:** `recharts` para dashboard
- **Datas:** `date-fns` com `ptBR` locale
- **Formulários:** `react-hook-form` + `zod`
- **Ícones:** `lucide-react`
- **Estado servidor:** Server Components do Next.js + `@supabase/ssr`
- **Estado cliente:** apenas onde necessário, com React hooks padrão (sem Redux, sem Zustand)
- **Deploy:** Vercel

**Não use:** App Router experimentos, server actions experimentais, ferramentas alfa. Mantenha o código com APIs estáveis.

---

## 3. Identidade visual oficial Ative+60

A identidade já existe e tem personalidade. **Não invente paleta — siga rigorosamente:**

### Paleta (CSS custom properties em globals.css)

```css
--color-verde-ative:      #7C9885   /* verde principal da marca */
--color-laranja-ative:    #D9824B   /* laranja do "+" e "60" do logo */
--color-creme-fundo:      #F5F1EA   /* fundo creme oficial */
--color-branco-card:      #FFFFFF   /* fundo de cards */
--color-tinta-texto:      #1C2A24   /* texto principal escuro */
--color-cinza-texto:      #6B7B73   /* texto secundário */
--color-linha-suave:      #E5E0D5   /* bordas e divisores */
--color-verde-sucesso:    #2E6B4F   /* indicadores positivos */
--color-vermelho-alerta:  #B85850   /* alertas e erros */
--color-ambar-aviso:      #C68A3F   /* avisos intermediários */
```

Uso em Tailwind: `bg-verde-ative`, `text-tinta-texto`, `border-linha-suave`, etc.

### Tipografia

- **Sans-serif principal:** Inter (Google Fonts) — toda a interface, números, dados, títulos

### Logo

O logotipo Ative+60 é composto por:
- 5 blocos quadrados verdes (cor verde-ative #7C9885) com letras brancas: **a · t · i · v · e**
- Um bloco laranja (cor laranja-ative #D9824B) com **+**
- O número **60** em laranja
- Subtítulo: "fisioterapia para idosos" (ou no app, pode ser "cuidado para pessoas 60+")

**Implementação:** crie um componente React `<AtiveLogo />` que renderiza os blocos com SVG inline ou divs estilizadas. Não dependa de imagem externa para o logo.

### Princípios de UX

- **Mobile-first absoluto** para a fisioterapeuta. Cada tela usada em campo precisa ter botões grandes, formulários simples, ações em no máximo 2 toques
- **Desktop refinado** para a gestão. Painéis com mais densidade de informação, tabelas, gráficos
- **Acessibilidade**: contraste alto, texto legível por idosos (na parte que famílias eventualmente verão), navegação por teclado funcional
- **Sem animações exageradas.** Transições sutis (200ms ease) apenas onde fazem sentido
- **Sem dark mode no MVP** — fundo creme é a marca

---

## 4. Estrutura completa do banco (já criada via SCHEMA_SUPABASE.sql)

### Tabela `profiles`
- `id` UUID (FK para auth.users)
- `full_name`, `email`, `phone`, `crefito`, `avatar_url`
- `role` ENUM: `'gestao'` ou `'fisio'`
- `repasse_value` numeric (valor por sessão para fisios)
- `created_at`

### Tabela `patients`
- `id` UUID
- Identificação: `full_name`, `birth_date`, `cpf`, `phone`, `address`, `photo_url`
- Família: `family_contact_name`, `family_relationship`, `family_phone`, `family_email`
- Plano: `primary_fisio_id` (FK profiles), `weekly_frequency` (1-7), `session_value`, `admission_date`
- Clínico: `primary_diagnosis`, `comorbidities`, `allergies`, `clinical_notes`
- Documental: `tcle_signed` boolean, `tcle_signed_at`, `commitment_signed` boolean
- `status`: `'active'` | `'paused'` | `'discharged'`
- `created_at`

### Tabela `medications`
- `id`, `patient_id` (FK), `name`, `dosage`, `frequency`, `notes`

### Tabela `appointments`
- `id`, `patient_id`, `fisio_id`
- `scheduled_date`, `scheduled_time`
- `check_in_at`, `check_out_at` (timestamps de presença real)
- `status`: `'scheduled'` | `'in_progress'` | `'completed'` | `'missed'` | `'cancelled'`

### Tabela `evolutions`
- `id`, `appointment_id`, `patient_id`, `fisio_id`
- Sinais vitais: `bp_initial` (text "120x80"), `bp_final`, `hr_initial` (int), `hr_final`, `spo2_initial` (int), `spo2_final`, `rr_initial` (int), `rr_final`
- Condutas: `conducts` (text array com tags: 'MHB', 'RPPI', 'Cinesio passiva', 'Cinesio ativa', 'Cinesio resistida', 'Treino de marcha', 'Treino de equilíbrio', 'Alongamento', etc — lista completa abaixo)
- `observations` (text livre, pode vir de transcrição de áudio)
- `had_intercurrence` boolean, `intercurrence_description`
- `created_at`

### Tabela `exams`
- `id`, `patient_id`, `name`, `exam_date`, `file_url`, `notes`, `uploaded_at`

### Tabela `monthly_reports`
- `id`, `patient_id`, `reference_month` (text "YYYY-MM")
- `pdf_url`, `sent_to_family_at`, `generated_at`

---

## 5. Lista oficial de condutas fisioterapêuticas

Baseado na ficha real da Ative+60. **Use esta lista exata** para os checkboxes/tags na tela de evolução:

```
Respiratórias:
- MHB (Manobras de Higiene Brônquica)
- RPPI
- Terapia pressórica
- Fortalecimento inspiratório
- RTA (Recurso de Treinamento Aeróbico)
- CPAP/BIPAP
- Shaker/Acapella/aerobika
- Aspiração
- Inaloterapia
- Oxigenoterapia

Posicionamento e mobilidade básica:
- Sedestação BL
- Poltrona
- Cicloergômetro
- Bipedestação
- Posicionamento

Cinesioterapia:
- Cinesio passiva
- Cinesio ativa-assistida
- Cinesio ativa
- Cinesio resistida
- Alongamento

Funcional:
- Treino de equilíbrio
- Treino de marcha
- Treino de transferências

Eletroterapia:
- TENS/US/Laser/FES

Outros:
- Atividades cognitivas
- Orientações
```

---

## 6. As 13 telas do MVP

### 6.1 Login (`/login`)
- E-mail e senha (Supabase Auth)
- Logo Ative+60 centralizado
- Após login: redirect baseado em `role` — `gestao` vai para `/dashboard`, `fisio` vai para `/agenda`

### 6.2 Dashboard da gestão (`/dashboard`)
- Saudação personalizada com hora do dia
- 4 cards de KPI: receita projetada, receita realizada, atendimentos previstos, atendimentos realizados (com período seletor)
- Card de "Atenção" com alertas: pacientes sem atendimento há mais de 7 dias, intercorrências da semana, evoluções pendentes
- Gráfico de barras: produção por fisioterapeuta no mês (recharts)
- Lista dos top 10 pacientes por receita
- Botão grande "+ Novo paciente"

### 6.3 Lista de pacientes (`/pacientes`)
- Busca por nome
- Filtros: fisio responsável, frequência, status
- Tabela ou grid com: nome, idade, fisio, frequência, ticket, último atendimento, status
- Cada linha clicável vai para detalhe
- Botão "+ Novo paciente"

### 6.4 Detalhe do paciente (`/pacientes/[id]`)
- Header com nome, idade, foto, botão editar
- Cards: fisio responsável, frequência, ticket, tempo de carteira ("X anos e Y meses na Ative"), próximo atendimento agendado
- Tabs: Dados, Medicamentos, Evoluções, Exames
- Botão "Gerar relatório mensal" e "Registrar atendimento"

### 6.5 Cadastro/Edição de paciente (`/pacientes/novo`, `/pacientes/[id]/editar`)
- Formulário em seções (mas tudo em uma tela com scroll):
  - Dados pessoais
  - Contato da família
  - Plano de atendimento
  - Histórico médico
  - Medicamentos (tabela editável)
  - Documentos: TCLE assinado? Termo de Compromisso assinado?

### 6.6 Equipe (`/equipe`)
- Cards de cada fisioterapeuta com: foto, nome, CREFITO, número de pacientes, atendimentos no mês, receita gerada
- Botão "+ Adicionar fisioterapeuta"

### 6.7 Detalhe da fisio (`/equipe/[id]`)
- Dados de cadastro
- Lista de pacientes atendidos por ela
- Gráfico de produção dos últimos 6 meses
- Lista de intercorrências reportadas
- Valor a receber no mês

### 6.8 Agenda do dia (`/agenda`) — TELA INICIAL DA FISIO
- Lista de atendimentos do dia
- Cada card: nome do paciente, endereço, horário sugerido, status
- Botão grande verde "Iniciar atendimento" em cada card pendente
- Menu inferior com "Agenda", "Pacientes", "Perfil"

### 6.9 Atendimento em andamento (`/atendimento/[id]`) — MOBILE-FIRST CRÍTICO
- Cabeçalho: nome do paciente, hora do check-in
- Sinais vitais entrada (PA, FC, SpO2, FR)
- Observações: campo de texto + botão de gravar áudio (browser API, transcreve depois)
- Condutas: tags clicáveis (lista oficial da seção 5)
- Sinais vitais saída
- Toggle "Houve intercorrência?" → se sim, abre campo descritivo
- Botão grande "Finalizar atendimento"

### 6.10 Histórico de evoluções (dentro do `/pacientes/[id]` aba "Evoluções")
- Lista cronológica reversa
- Cada item: data, fisio, sinais vitais, condutas, observações
- Filtro por mês
- Indicador visual de intercorrência

### 6.11 Geração de relatório mensal (`/pacientes/[id]/relatorio`)
- Seletor de mês
- Preview em tempo real
- **Layout do PDF (modelado pela avaliação real do Ramiro Dantas):**
  - Cabeçalho com logo Ative+60, "RELATÓRIO MENSAL DE FISIOTERAPIA"
  - Dados do paciente
  - Período do relatório
  - Quantidade de atendimentos realizados
  - Sinais vitais médios (PA, FC, SpO2)
  - Condutas mais aplicadas
  - Resumo narrativo das evoluções (concatenação editável das observations)
  - Pontos de atenção (intercorrências do mês)
  - Próximos passos clínicos (texto editável pela gestão)
  - Rodapé com: AMANDA CARDOSO CREFITO 171522-F + RAYANNE PAIVA CREFITO 176945-F + Instagram @ativemais60
- Botões: "Baixar PDF", "Enviar por WhatsApp" (gera link wa.me)

### 6.12 Painel financeiro (`/financeiro`)
- Cards: receita bruta, repasses pagos, lucro estimado
- Tabela de pacientes do mês: nome, sessões realizadas, valor a cobrar, status
- Tabela de repasses: fisio, sessões, valor a pagar
- Botão "Exportar planilha"

### 6.13 Configurações (`/configuracoes`)
- Dados da empresa Ative
- Logo (já vem fixo, mas pode haver upload)
- Lista de usuários
- Configuração de tabela de repasse padrão

---

## 7. Regras de negócio (já refletidas no schema)

- **RN-01 Receita projetada:** Σ (frequencia_semanal × 4.33 × session_value) de pacientes ativos
- **RN-02 Receita realizada:** Σ (session_value × evolutions completas no mês)
- **RN-03 Auto-geração de appointments:** ao cadastrar paciente, gerar appointments para 30 dias respeitando frequência
- **RN-04 Alerta de paciente sem atendimento:** se paciente ativo sem appointment completed há +7 dias
- **RN-05 RLS:** fisio só vê pacientes onde `primary_fisio_id = auth.uid()`. Gestão vê tudo. **Já implementado no SQL.**
- **RN-06 Tempo de carteira:** calcular de admission_date até hoje, mostrar como "X anos e Y meses"
- **RN-07 Repasse:** Σ (evolutions completed do fisio no mês × repasse_value do profile)
- **RN-08 Resumo do relatório:** concatenação inicial das observations das evolutions do mês, editável
- **RN-09 Status de appointment:** scheduled → in_progress (no check-in) → completed (no check-out) ou missed
- **RN-10 Idade:** calcular de birth_date

---

## 8. Pacientes reais (anonimizados)

Os 28 pacientes reais foram seedados via SCHEMA_SUPABASE.sql com sobrenomes alterados. **Não regenere.** Use o que está no banco.

Nomes anonimizados que aparecem:
- Maria do Carmo Silva → Dona Carmem da Silva
- Dione Lins → Dona Dilma Lins
- Vitória Leopoldina → Dona Vitória L.
- (etc — ver SQL)

---

## 9. Fluxos críticos a validar

### Fluxo 1: Atendimento da fisio
1. Login → /agenda
2. Clica "Iniciar atendimento" → registra check_in_at, status='in_progress'
3. Preenche evolução
4. Clica "Finalizar" → registra check_out_at, status='completed', salva evolution
5. Volta para /agenda

### Fluxo 2: Gerar relatório
1. Gestão entra no detalhe do paciente
2. Clica "Gerar relatório mensal"
3. Sistema consolida evolutions do mês selecionado
4. Mostra preview editável
5. "Baixar PDF" ou "Enviar por WhatsApp"

### Fluxo 3: Cadastrar paciente novo
1. Gestão clica "+ Novo paciente"
2. Preenche formulário
3. Adiciona medicamentos
4. Salva → redireciona para detalhe do paciente
5. Sistema gera appointments automaticamente para 30 dias

---

## 10. Princípios de código

- **Componentes pequenos e reutilizáveis** — máximo 200 linhas por arquivo
- **Server Components por padrão** — Client Components só quando há interatividade real
- **Tipagem rigorosa** — sem `any`, use os tipos gerados pelo Supabase
- **Use `@supabase/ssr`** para autenticação (não use `@supabase/supabase-js` diretamente em Server Components)
- **Mensagens em português brasileiro** em toda a interface
- **Datas formatadas no padrão BR** (DD/MM/AAAA)
- **Valores monetários:** R$ 1.234,56 (formato brasileiro)
- **Acessibilidade:** labels em todos os inputs, roles e aria-labels onde fizer sentido
- **Sem `console.log` em produção** — use try/catch com tratamento real

---

## 11. Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.local` deve estar no `.gitignore` (já vem por padrão no Next.js).

---

## 12. Estrutura de pastas sugerida

```
ative-mais-60-app/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (gestao)/
│   │   ├── dashboard/
│   │   ├── pacientes/
│   │   ├── equipe/
│   │   ├── financeiro/
│   │   └── configuracoes/
│   ├── (fisio)/
│   │   ├── agenda/
│   │   └── atendimento/
│   ├── api/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn)
│   ├── ative/ (componentes proprietários: AtiveLogo, etc)
│   ├── dashboard/
│   ├── pacientes/
│   └── relatorio/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── utils.ts
│   ├── pdf/
│   └── validations/ (schemas zod)
├── types/
│   └── database.ts (gerado do Supabase)
├── public/
└── middleware.ts
```

---

**Fim do CONTEXT.md.** O Claude Code deve ler este documento antes de qualquer ação e voltar a ele sempre que houver dúvida arquitetural.
