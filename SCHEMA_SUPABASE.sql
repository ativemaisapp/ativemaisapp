-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHEMA_SUPABASE.sql — Ative+60 App (MVP)                              ║
-- ║  Banco completo: DDL + RLS + Seed (28 pacientes + ~550 evoluções)       ║
-- ║  Executar em uma ÚNICA passada no SQL Editor do Supabase                ║
-- ║  Data de referência: execução gera dados relativos a CURRENT_DATE       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝


-- =========================================================================
-- 1. EXTENSÕES E LIMPEZA
-- =========================================================================
-- Remove tabelas em ordem reversa de dependência e recria extensões.

DROP TABLE IF EXISTS monthly_reports CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS evolutions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS status_appointment CASCADE;
DROP TYPE IF EXISTS status_patient CASCADE;
DROP TYPE IF EXISTS role_profile CASCADE;

DROP FUNCTION IF EXISTS is_gestao() CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =========================================================================
-- 2. ENUMS E TIPOS CUSTOMIZADOS
-- =========================================================================

CREATE TYPE role_profile     AS ENUM ('gestao', 'fisio');
CREATE TYPE status_patient   AS ENUM ('active', 'paused', 'discharged');
CREATE TYPE status_appointment AS ENUM (
  'scheduled', 'in_progress', 'completed', 'missed', 'cancelled'
);


-- =========================================================================
-- 3. TABELA profiles
-- =========================================================================
-- Perfis da equipe (fisioterapeutas e gestão).
-- O campo id será vinculado ao auth.users na seção 18.

CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  crefito       TEXT,
  avatar_url    TEXT,
  role          role_profile NOT NULL DEFAULT 'fisio',
  repasse_value NUMERIC(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 4. TABELA patients
-- =========================================================================

CREATE TABLE patients (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name            TEXT NOT NULL,
  birth_date           DATE,
  cpf                  TEXT,
  phone                TEXT,
  address              TEXT,
  photo_url            TEXT,
  family_contact_name  TEXT,
  family_relationship  TEXT,
  family_phone         TEXT,
  family_email         TEXT,
  primary_fisio_id     UUID REFERENCES profiles(id) ON UPDATE CASCADE,
  weekly_frequency     INTEGER CHECK (weekly_frequency BETWEEN 1 AND 7),
  session_value        NUMERIC(10,2),
  admission_date       DATE,
  primary_diagnosis    TEXT,
  comorbidities        TEXT,
  allergies            TEXT,
  clinical_notes       TEXT,
  tcle_signed          BOOLEAN DEFAULT false,
  tcle_signed_at       TIMESTAMPTZ,
  commitment_signed    BOOLEAN DEFAULT false,
  status               status_patient NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 5. TABELA medications
-- =========================================================================

CREATE TABLE medications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  dosage     TEXT,
  frequency  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 6. TABELA appointments
-- =========================================================================

CREATE TABLE appointments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  fisio_id       UUID NOT NULL REFERENCES profiles(id) ON UPDATE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  check_in_at    TIMESTAMPTZ,
  check_out_at   TIMESTAMPTZ,
  status         status_appointment NOT NULL DEFAULT 'scheduled',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 7. TABELA evolutions
-- =========================================================================

CREATE TABLE evolutions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id           UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id               UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  fisio_id                 UUID NOT NULL REFERENCES profiles(id) ON UPDATE CASCADE,
  bp_initial               TEXT,       -- PA inicial, formato "120x80"
  bp_final                 TEXT,       -- PA final
  hr_initial               INTEGER,   -- FC inicial (bpm)
  hr_final                 INTEGER,   -- FC final
  spo2_initial             INTEGER,   -- SpO2 inicial (%)
  spo2_final               INTEGER,   -- SpO2 final
  rr_initial               INTEGER,   -- FR inicial (irpm)
  rr_final                 INTEGER,   -- FR final
  conducts                 TEXT[],    -- Condutas aplicadas (lista oficial Ative+60)
  observations             TEXT,      -- Narrativa clínica da sessão
  had_intercurrence        BOOLEAN DEFAULT false,
  intercurrence_description TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 8. TABELA exams
-- =========================================================================

CREATE TABLE exams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  exam_date   DATE,
  file_url    TEXT,
  notes       TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 9. TABELA monthly_reports
-- =========================================================================

CREATE TABLE monthly_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL,   -- Formato "YYYY-MM"
  pdf_url         TEXT,
  sent_to_family_at TIMESTAMPTZ,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
-- 10. ÍNDICES DE PERFORMANCE
-- =========================================================================

-- patients
CREATE INDEX idx_patients_primary_fisio ON patients(primary_fisio_id);
CREATE INDEX idx_patients_status        ON patients(status);

-- appointments
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_fisio          ON appointments(fisio_id);
CREATE INDEX idx_appointments_patient        ON appointments(patient_id);
CREATE INDEX idx_appointments_status         ON appointments(status);

-- evolutions
CREATE INDEX idx_evolutions_patient_date ON evolutions(patient_id, created_at DESC);
CREATE INDEX idx_evolutions_fisio        ON evolutions(fisio_id);
CREATE INDEX idx_evolutions_appointment  ON evolutions(appointment_id);

-- medications / exams
CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_exams_patient       ON exams(patient_id);


-- =========================================================================
-- 11. FUNÇÕES PL/pgSQL AUXILIARES
-- =========================================================================

-- Verifica se o usuário autenticado tem role = 'gestao'.
-- SECURITY DEFINER permite ler profiles mesmo com RLS ativo.
CREATE OR REPLACE FUNCTION is_gestao()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'gestao'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =========================================================================
-- 12. ROW LEVEL SECURITY (políticas por tabela)
-- =========================================================================
-- Gestão vê tudo. Fisio vê apenas seus dados / pacientes vinculados.

-- ── profiles ──────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_gestao"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_gestao());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── patients ──────────────────────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_select"
  ON patients FOR SELECT TO authenticated
  USING (is_gestao() OR primary_fisio_id = auth.uid());

CREATE POLICY "patients_insert"
  ON patients FOR INSERT TO authenticated
  WITH CHECK (is_gestao());

CREATE POLICY "patients_update"
  ON patients FOR UPDATE TO authenticated
  USING (is_gestao()) WITH CHECK (is_gestao());

CREATE POLICY "patients_delete"
  ON patients FOR DELETE TO authenticated
  USING (is_gestao());

-- ── medications ───────────────────────────────────────────────────────────
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications_select"
  ON medications FOR SELECT TO authenticated
  USING (
    is_gestao()
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = medications.patient_id
        AND p.primary_fisio_id = auth.uid()
    )
  );

CREATE POLICY "medications_insert"
  ON medications FOR INSERT TO authenticated
  WITH CHECK (is_gestao());

CREATE POLICY "medications_update"
  ON medications FOR UPDATE TO authenticated
  USING (is_gestao()) WITH CHECK (is_gestao());

CREATE POLICY "medications_delete"
  ON medications FOR DELETE TO authenticated
  USING (is_gestao());

-- ── appointments ──────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT TO authenticated
  USING (is_gestao() OR fisio_id = auth.uid());

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT TO authenticated
  WITH CHECK (is_gestao());

-- Fisio pode atualizar status, check_in_at, check_out_at dos próprios.
-- Gestão pode atualizar qualquer campo.
CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE TO authenticated
  USING (is_gestao() OR fisio_id = auth.uid())
  WITH CHECK (is_gestao() OR fisio_id = auth.uid());

CREATE POLICY "appointments_delete"
  ON appointments FOR DELETE TO authenticated
  USING (is_gestao());

-- ── evolutions ────────────────────────────────────────────────────────────
ALTER TABLE evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evolutions_select"
  ON evolutions FOR SELECT TO authenticated
  USING (is_gestao() OR fisio_id = auth.uid());

CREATE POLICY "evolutions_insert"
  ON evolutions FOR INSERT TO authenticated
  WITH CHECK (fisio_id = auth.uid() OR is_gestao());

-- Fisio pode editar evolução apenas nas primeiras 24 horas.
CREATE POLICY "evolutions_update"
  ON evolutions FOR UPDATE TO authenticated
  USING (
    is_gestao()
    OR (fisio_id = auth.uid() AND created_at > now() - INTERVAL '24 hours')
  )
  WITH CHECK (
    is_gestao()
    OR (fisio_id = auth.uid() AND created_at > now() - INTERVAL '24 hours')
  );

-- ── exams ─────────────────────────────────────────────────────────────────
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_select"
  ON exams FOR SELECT TO authenticated
  USING (
    is_gestao()
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = exams.patient_id
        AND p.primary_fisio_id = auth.uid()
    )
  );

CREATE POLICY "exams_insert"
  ON exams FOR INSERT TO authenticated
  WITH CHECK (is_gestao());

CREATE POLICY "exams_delete"
  ON exams FOR DELETE TO authenticated
  USING (is_gestao());

-- ── monthly_reports ───────────────────────────────────────────────────────
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reports_gestao_only"
  ON monthly_reports FOR ALL TO authenticated
  USING (is_gestao())
  WITH CHECK (is_gestao());


-- =========================================================================
-- 13. SEED — INSERÇÃO DE PROFILES
-- =========================================================================
-- 6 perfis: 3 gestão (Guilherme, Amanda, Rayanne) + 3 fisio (Ismênia, Líbia, Kívia)
-- UUIDs temporários — serão substituídos na seção 18 (vinculação auth.users)

INSERT INTO profiles (id, full_name, email, phone, crefito, role, repasse_value) VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000001', 'Guilherme Duarte',  'guilherme@somosdom.io',       '(83) 99900-0001', NULL,       'gestao', NULL),
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 'Amanda Cardoso',    'amanda@ativemais60.com.br',    '(83) 99900-0002', '171522-F', 'gestao', NULL),
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 'Rayanne Paiva',     'rayanne@ativemais60.com.br',   '(83) 99900-0003', '176945-F', 'gestao', NULL),
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 'Ismênia Pereira',   'ismenia@ativemais60.com.br',   '(83) 99900-0004', '182033-F', 'fisio',  70.00),
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 'Líbia',             'libia@ativemais60.com.br',     '(83) 99900-0005', '184567-F', 'fisio',  70.00),
  ('a1b2c3d4-e5f6-4a7b-8c9d-000000000006', 'Kívia',             'kivia@ativemais60.com.br',     '(83) 99900-0006', '189234-F', 'fisio',  65.00);


-- =========================================================================
-- 14. SEED — INSERÇÃO DE 28 PACIENTES
-- =========================================================================
-- Dados reais anonimizados da carteira Ative+60 (sobrenomes abreviados).
-- Endereços, telefones e familiares fictícios, verossímeis para João Pessoa-PB.

INSERT INTO patients (
  full_name, birth_date, cpf, phone, address,
  family_contact_name, family_relationship, family_phone, family_email,
  primary_fisio_id, weekly_frequency, session_value, admission_date,
  primary_diagnosis, comorbidities, allergies, clinical_notes,
  tcle_signed, tcle_signed_at, commitment_signed, status
) VALUES

-- 1) Dione L. — 87 anos, 5x/sem, Rayanne
(
  'Dione L.', '1939-03-12', '045.238.714-83', '(83) 99812-3456',
  'Rua João Câncio da Silva, 245, Manaíra, João Pessoa-PB',
  'Ana Paula L.', 'filha', '(83) 99876-5432', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 5, 170.00, '2018-05-01',
  'Síndrome de fragilidade do idoso, sequela de AVE',
  'Hipertensão arterial sistêmica, diabetes mellitus tipo 2, osteoporose',
  NULL,
  'Histórico de AVE em 2017. Hemiparesia esquerda residual leve. Deambula com auxílio de andador. Necessita supervisão contínua.',
  true, '2018-05-01', true, 'active'
),

-- 2) Maria do Carmo S. — 91 anos, 5x/sem, Rayanne
(
  'Maria do Carmo S.', '1935-01-20', '312.567.924-01', '(83) 99734-2198',
  'Rua Infante Dom Henrique, 890, Tambaú, João Pessoa-PB',
  'Roberto S.', 'filho', '(83) 99845-1234', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 5, 165.00, '2014-06-15',
  'Demência de Alzheimer estágio moderado',
  'Hipertensão arterial sistêmica, hipotireoidismo',
  'Dipirona',
  'Paciente na Ative desde 2014. Demência moderada com comprometimento de AVDs. Necessita estímulo constante. Cuidadora 24h.',
  true, '2014-06-15', true, 'active'
),

-- 3) Vitória Leopoldina S. — 79 anos, 4x/sem, Amanda
(
  'Vitória Leopoldina S.', '1947-02-08', '789.123.456-72', '(83) 99623-8877',
  'Av. Gov. Flávio Ribeiro Coutinho, 1200, Altiplano, João Pessoa-PB',
  'Marcos S.', 'filho', '(83) 99912-3344', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 4, 190.00, '2023-01-10',
  'Pós-operatório de PTQ, reabilitação motora',
  'Hipertensão arterial sistêmica, osteoartrose de joelhos',
  NULL,
  'PTQ bilateral em 2022. Reabilitação motora com foco em ganho de ADM e fortalecimento de quadríceps. Boa evolução funcional.',
  true, '2023-01-10', true, 'active'
),

-- 4) Vilma G. — 78 anos, 4x/sem, Amanda
(
  'Vilma G.', '1948-02-14', '234.891.537-29', '(83) 99567-4455',
  'Rua Maria Rosa de Lima, 312, Bessa, João Pessoa-PB',
  'Patrícia G.', 'filha', '(83) 99789-0011', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 4, 190.00, '2026-04-01',
  'DPOC moderada, reabilitação respiratória',
  'Hipertensão arterial sistêmica, cor pulmonale leve',
  NULL,
  'Paciente recém-admitida. DPOC Gold II com dispneia aos médios esforços. Protocolo de reabilitação pulmonar domiciliar.',
  true, '2026-04-01', true, 'active'
),

-- 5) Vitória Maria L. — 82 anos, 3x/sem, Ismênia
(
  'Vitória Maria L.', '1944-03-22', '567.234.891-15', '(83) 99456-7788',
  'Rua José Florentino Jr., 78, Jardim Oceania, João Pessoa-PB',
  'Luciana L.', 'filha', '(83) 99678-2233', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 3, 190.00, '2024-05-20',
  'Doença de Parkinson',
  'Constipação crônica, depressão leve',
  NULL,
  'Parkinson Hoehn & Yahr II. Tremor em repouso em MSD. Rigidez axial. Treino de marcha e equilíbrio prioritários.',
  true, '2024-05-20', true, 'active'
),

-- 6) Antônio Ximenes B. — 75 anos, 3x/sem, Rayanne
(
  'Antônio Ximenes B.', '1951-01-30', '891.567.234-43', '(83) 99345-6677',
  'Rua Josefa Taveira, 456, Bancários, João Pessoa-PB',
  'Fernanda B.', 'filha', '(83) 99567-8899', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 3, 190.00, '2025-07-12',
  'Pós-AVE, hemiparesia direita',
  'Hipertensão arterial sistêmica, diabetes mellitus tipo 2, dislipidemia',
  NULL,
  'AVE isquêmico em 06/2025. Hemiparesia D grau 3. Reabilitação neuromotora ativa. Usa bengala canadense.',
  true, '2025-07-12', true, 'active'
),

-- 7) Lourdes M. — 81 anos, 3x/sem, Rayanne
(
  'Lourdes M.', '1945-01-17', '345.678.912-57', '(83) 99234-5566',
  'Rua Bancário Waldemar de M. Lins, 89, Bancários, João Pessoa-PB',
  'Carlos M.', 'filho', '(83) 99456-7700', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 3, 190.00, '2025-10-05',
  'Osteoartrose grave de joelho',
  'Hipertensão arterial sistêmica, obesidade grau I',
  'AAS',
  'Gonartrose bilateral Kellgren IV. Dor crônica em joelhos, pior à D. Protocolo de analgesia e fortalecimento muscular.',
  true, '2025-10-05', true, 'active'
),

-- 8) Maria Vitória A. — 84 anos, 3x/sem, Rayanne (primary), compartilhada com Amanda
(
  'Maria Vitória A.', '1942-03-05', '678.912.345-71', '(83) 99123-4455',
  'Rua Sebastião Interaminense, 567, Tambaú, João Pessoa-PB',
  'Helena A.', 'filha', '(83) 99345-6611', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 3, 180.00, '2025-07-22',
  'Sarcopenia, baixa mobilidade',
  'Osteoporose, hipovitaminose D',
  NULL,
  'Sarcopenia confirmada por DXA. Protocolo de fortalecimento muscular progressivo e suplementação proteica. Atendimento compartilhado Amanda/Rayanne.',
  true, '2025-07-22', true, 'active'
),

-- 9) Carlos Antônio R. — 78 anos, 3x/sem, Ismênia
(
  'Carlos Antônio R.', '1948-04-03', '912.345.678-85', '(83) 99012-3344',
  'Rua Francisco Brandão, 123, Manaíra, João Pessoa-PB',
  'Adriana R.', 'filha', '(83) 99234-5500', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 3, 180.00, '2024-12-01',
  'Síndrome do imobilismo',
  'Hipertensão arterial sistêmica, diabetes mellitus tipo 2, sequela de AVE prévio',
  NULL,
  'Imobilismo secundário a AVE prévio (2023). Dependente para transferências. Cuidador presente em todas as sessões.',
  true, '2024-12-01', true, 'active'
),

-- 10) Lauriete D. — 89 anos, 3x/sem, Amanda
(
  'Lauriete D.', '1937-04-11', '456.789.123-99', '(83) 98901-2233',
  'Rua Cônego Lima, 234, Tambaú, João Pessoa-PB',
  'Sônia D.', 'filha', '(83) 99123-4400', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 3, 160.00, '2020-01-15',
  'Demência vascular',
  'Hipertensão arterial sistêmica, insuficiência venosa crônica',
  NULL,
  'Demência vascular moderada. Alterações comportamentais leves. Mantém alguma interação social. Fisioterapia de manutenção funcional.',
  true, '2020-01-15', true, 'active'
),

-- 11) Juvenal da R. — 73 anos, 2x/sem, Ismênia
(
  'Juvenal da R.', '1953-02-19', '123.891.567-13', '(83) 98890-1122',
  'Rua Tabelião Stanislau Eloy, 890, Altiplano, João Pessoa-PB',
  'Marcos R.', 'filho', '(83) 99012-3300', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 2, 190.00, '2026-01-08',
  'Pós-fratura de fêmur',
  'Osteoporose, hipertensão arterial sistêmica',
  NULL,
  'Fratura de fêmur proximal D em 12/2025. Osteossíntese com DHS. Treino de marcha progressivo com andador.',
  true, '2026-01-08', true, 'active'
),

-- 12) Cryselide de M. — 80 anos, 2x/sem, Líbia
(
  'Cryselide de M.', '1946-03-25', '567.123.891-27', '(83) 98789-0011',
  'Rua Paulino Pinto, 345, Jardim Oceania, João Pessoa-PB',
  'Rafael M.', 'filho', '(83) 98901-2200', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 2, 190.00, '2025-07-18',
  'Lombalgia crônica',
  'Artrose lombar degenerativa, hipertensão arterial leve',
  'Ibuprofeno',
  'Lombalgia crônica há mais de 10 anos. Artrose L4-L5 e L5-S1. Protocolo de estabilização lombar e alívio de dor.',
  true, '2025-07-18', true, 'active'
),

-- 13) Maria Carmem F. — 83 anos, 2x/sem, Líbia
(
  'Maria Carmem F.', '1943-01-30', '891.234.567-41', '(83) 98678-9900',
  'Rua Des. Boto de Menezes, 678, Aeroclube, João Pessoa-PB',
  'Juliana F.', 'filha', '(83) 98890-1100', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 2, 190.00, '2026-04-10',
  'Insuficiência cardíaca compensada',
  'Hipertensão arterial sistêmica, fibrilação atrial crônica',
  NULL,
  'IC NYHA II compensada. FA crônica em uso de anticoagulante. Protocolo de exercícios aeróbicos leves e monitoramento.',
  true, '2026-04-10', true, 'active'
),

-- 14) Enilda U. — 77 anos, 2x/sem, Ismênia
(
  'Enilda U.', '1949-03-07', '234.567.891-55', '(83) 98567-8899',
  'Rua Maria Caetano Fernandes, 123, Bessa, João Pessoa-PB',
  'Paulo U.', 'filho', '(83) 98789-0000', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 2, 190.00, '2023-07-30',
  'Osteoporose, prevenção de quedas',
  'Artralgia em joelhos, hipovitaminose D',
  NULL,
  'Osteoporose com T-score -3.2 em fêmur. Histórico de 2 quedas em 2023. Treino de equilíbrio e fortalecimento de MMII.',
  true, '2023-07-30', true, 'active'
),

-- 15) Tânia Maria C. — 76 anos, 2x/sem, Rayanne
(
  'Tânia Maria C.', '1950-02-18', '678.345.912-69', '(83) 98456-7788',
  'Rua Nego, 456, Intermares, Cabedelo-PB',
  'Ricardo C.', 'filho', '(83) 98678-9900', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 2, 190.00, '2025-07-25',
  'Reabilitação pós-cirurgia de coluna',
  'Hipertensão arterial sistêmica, hérnia discal operada L4-L5',
  NULL,
  'Artrodese L4-L5 em 06/2025. Pós-op tardio estável. Fortalecimento de core e reeducação postural.',
  true, '2025-07-25', true, 'active'
),

-- 16) Terezinha Junqueira P. — 86 anos, 2x/sem, Rayanne
(
  'Terezinha Junqueira P.', '1940-01-22', '345.912.678-83', '(83) 98345-6677',
  'Rua João Pessoa de Queiroz, 789, Manaíra, João Pessoa-PB',
  'Marta P.', 'filha', '(83) 98567-8800', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 2, 190.00, '2025-01-15',
  'Bradicinesia de Parkinson leve',
  'Constipação intestinal crônica, depressão leve',
  NULL,
  'Parkinson Hoehn & Yahr I-II. Bradicinesia predominante. Sem tremor significativo. Treino de agilidade e coordenação.',
  true, '2025-01-15', true, 'active'
),

-- 17) Maria Idete (Creusa) M. — 88 anos, 2x/sem, Amanda
(
  'Maria Idete (Creusa) M.', '1938-03-15', '912.678.345-97', '(83) 98234-5566',
  'Rua Juiz Ovídio Gouveia, 234, Aeroclube, João Pessoa-PB',
  'Jorge M.', 'filho', '(83) 98456-7700', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 2, 180.00, '2025-10-20',
  'Pós-internação por pneumonia',
  'DPOC leve, desnutrição proteica',
  NULL,
  'Internação por PAC em 09/2025. Alta com sequela respiratória. Protocolo de reabilitação pulmonar e reconditioning.',
  true, '2025-10-20', true, 'active'
),

-- 18) Ellen de Azevedo T. — 81 anos, 2x/sem, Amanda
(
  'Ellen de Azevedo T.', '1945-04-03', '456.912.789-11', '(83) 98123-4455',
  'Rua Prof. Maria Sales, 567, Altiplano, João Pessoa-PB',
  'Marcelo T.', 'cônjuge', '(83) 98345-6600', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 2, 180.00, '2025-08-15',
  'DPOC leve, condicionamento',
  'Hipertensão arterial controlada, ansiedade',
  NULL,
  'DPOC Gold I. Boa saturação em repouso. Foco em condicionamento cardiorrespiratório e manutenção da capacidade funcional.',
  true, '2025-08-15', true, 'active'
),

-- 19) Anete U. — 79 anos, 2x/sem, Líbia
(
  'Anete U.', '1947-02-12', '789.456.123-25', '(83) 98012-3344',
  'Rua Dr. José G. de Queiroz, 890, Bessa, João Pessoa-PB',
  'Renata U.', 'filha', '(83) 98234-5500', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 2, 180.00, '2025-07-28',
  'Lombalgia, reeducação postural',
  'Escoliose degenerativa, artrose facetária',
  NULL,
  'Lombalgia mecânica recorrente. Escoliose dorso-lombar. RPG adaptada ao domicílio. Boa resposta ao protocolo.',
  true, '2025-07-28', true, 'active'
),

-- 20) Teresinha Neves O. — 85 anos, 2x/sem, Líbia
(
  'Teresinha Neves O.', '1941-02-28', '123.456.912-39', '(83) 97901-2233',
  'Rua Antônio Rabelo, 123, Manaíra, João Pessoa-PB',
  'Célia O.', 'filha', '(83) 98123-4400', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 2, 180.00, '2024-11-10',
  'Síndrome do imobilismo leve',
  'Hipertensão arterial sistêmica, osteoartrose de quadril',
  NULL,
  'Imobilismo leve secundário a dor em quadril D. Deambula pouco em casa. Protocolo de reativação progressiva.',
  true, '2024-11-10', true, 'active'
),

-- 21) José Neto B. — 74 anos, 2x/sem, Rayanne
(
  'José Neto B.', '1952-01-09', '567.891.234-53', '(83) 97890-1122',
  'Rua Juiz Adauto Oitava, 456, Jardim Oceania, João Pessoa-PB',
  'Cláudia B.', 'cônjuge', '(83) 98012-3300', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 2, 180.00, '2025-11-05',
  'Hipertensão arterial, condicionamento',
  'Diabetes mellitus tipo 2, sobrepeso',
  NULL,
  'HAS estágio II com DM2. Sedentário prévio. Protocolo de condicionamento físico aeróbico e resistido.',
  true, '2025-11-05', true, 'active'
),

-- 22) Francisco de Assis P. — 82 anos, 2x/sem, Ismênia
(
  'Francisco de Assis P.', '1944-03-25', '891.456.567-67', '(83) 97789-0011',
  'Rua Min. José Américo de Almeida, 789, Tambaú, João Pessoa-PB',
  'Teresa P.', 'cônjuge', '(83) 97901-2200', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', 2, 175.00, '2025-03-15',
  'Sequela de AVE leve',
  'Hipertensão arterial sistêmica, dislipidemia, hemiparesia esquerda residual',
  NULL,
  'AVE isquêmico em 02/2025. Hemiparesia E leve, grau 4. Marcha com leve claudicação. Bom prognóstico funcional.',
  true, '2025-03-15', true, 'active'
),

-- 23) Cleide Machado V. — 86 anos, 2x/sem, Líbia
(
  'Cleide Machado V.', '1940-04-18', '234.789.456-81', '(83) 97678-9900',
  'Rua Des. Souto Maior, 234, Tambaú, João Pessoa-PB',
  'André V.', 'filho', '(83) 97890-1100', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 2, 160.00, '2021-01-10',
  'Demência vascular',
  'Hipertensão arterial sistêmica, fibrilação atrial',
  'AAS',
  'Demência vascular avançada. Comunicação verbal limitada. Fisioterapia motora passiva e posicionamento. Cuidadora integral.',
  true, '2021-01-10', true, 'active'
),

-- 24) Maria Gisélia N. — 90 anos, 2x/sem, Rayanne
(
  'Maria Gisélia N.', '1936-02-14', '678.234.891-95', '(83) 97567-8899',
  'Rua Maria Elizabeth, 567, Aeroclube, João Pessoa-PB',
  'Fátima N.', 'filha', '(83) 97789-0000', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', 2, 170.00, '2020-09-22',
  'Demência de Alzheimer estágio inicial',
  'Hipertensão arterial controlada, osteoporose',
  NULL,
  'Alzheimer CDR 1. Ainda orientada no tempo/espaço. Fisioterapia de manutenção e estimulação cognitiva motora.',
  true, '2020-09-22', true, 'active'
),

-- 25) Maria Aparecida F. — 72 anos, 2x/sem, Kívia
(
  'Maria Aparecida F.', '1954-03-27', '456.678.234-09', '(83) 97456-7788',
  'Rua São Geraldo, 45, Jardim Veneza, João Pessoa-PB',
  'Sandra F.', 'filha', '(83) 97678-9900', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000006', 2, 150.00, '2025-04-08',
  'Lombalgia mecânica, reabilitação',
  'Hipertensão arterial sistêmica, artrose de coluna lombar',
  NULL,
  'Lombalgia mecânica crônica. Artrose facetária L3-L5. Protocolo de cinesioterapia e orientações posturais.',
  true, '2025-04-08', true, 'active'
),

-- 26) Maria Felix R. — 84 anos, 1x/sem, Amanda
(
  'Maria Felix R.', '1942-01-10', '912.567.345-23', '(83) 97345-6677',
  'Rua Audálio Gonçalves, 890, Cabedelo-PB',
  'Rosana R.', 'filha', '(83) 97567-8800', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 1, 180.00, '2024-01-20',
  'Manutenção pós-fisioterapia respiratória',
  'DPOC controlada, hipertensão arterial sistêmica',
  NULL,
  'DPOC estável após reabilitação intensiva. Sessão semanal de manutenção respiratória e condicionamento.',
  true, '2024-01-20', true, 'active'
),

-- 27) Antônia D. — 71 anos, 1x/sem, Amanda
(
  'Antônia D.', '1955-01-22', '345.891.567-37', '(83) 97234-5566',
  'Rua Prof. Estevão Ramalho, 123, Intermares, Cabedelo-PB',
  'Marcos D.', 'cônjuge', '(83) 97456-7700', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', 1, 180.00, '2026-03-15',
  'Cervicalgia crônica',
  'Artrose cervical C4-C6, cefaleia tensional',
  NULL,
  'Cervicalgia crônica há 5 anos. Artrose cervical degenerativa. Protocolo de alongamento, mobilização cervical e orientações ergonômicas.',
  true, '2026-03-15', true, 'active'
),

-- 28) Juracy M. — 88 anos, 1x/sem, Líbia
(
  'Juracy M.', '1938-01-15', '789.345.678-51', '(83) 97123-4455',
  'Rua Geraldo Costa, 456, Cabedelo-PB',
  'Lúcia M.', 'filha', '(83) 97345-6600', NULL,
  'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', 1, 180.00, '2023-07-12',
  'Manutenção, idoso ativo',
  'Hipertensão arterial controlada',
  NULL,
  'Idoso ativo com boa funcionalidade. Sessão semanal de manutenção: equilíbrio, marcha e prevenção de quedas.',
  true, '2023-07-12', true, 'active'
);


-- =========================================================================
-- 15. SEED — INSERÇÃO DE MEDICAMENTOS
-- =========================================================================
-- 1-4 medicamentos por paciente, coerentes com o quadro clínico.

INSERT INTO medications (patient_id, name, dosage, frequency, notes) VALUES

-- Dione L.
((SELECT id FROM patients WHERE full_name = 'Dione L.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Dione L.'), 'Metformina', '850mg', '2x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Dione L.'), 'Cálcio + Vitamina D', '600mg/400UI', '1x ao dia', NULL),

-- Maria do Carmo S.
((SELECT id FROM patients WHERE full_name = 'Maria do Carmo S.'), 'Donepezila', '10mg', '1x ao dia', 'Para Alzheimer'),
((SELECT id FROM patients WHERE full_name = 'Maria do Carmo S.'), 'Levotiroxina', '75mcg', '1x ao dia em jejum', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria do Carmo S.'), 'Losartana', '50mg', '1x ao dia', NULL),

-- Vitória Leopoldina S.
((SELECT id FROM patients WHERE full_name = 'Vitória Leopoldina S.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Vitória Leopoldina S.'), 'AAS', '100mg', '1x ao dia', 'Profilaxia'),
((SELECT id FROM patients WHERE full_name = 'Vitória Leopoldina S.'), 'Paracetamol', '750mg', 'Se necessário', 'Para dor pós-exercício'),

-- Vilma G.
((SELECT id FROM patients WHERE full_name = 'Vilma G.'), 'Brometo de Ipratrópio', '0,25mg/mL', '3x ao dia inalação', NULL),
((SELECT id FROM patients WHERE full_name = 'Vilma G.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Vilma G.'), 'Prednisolona', '5mg', '1x ao dia', 'Fase de manutenção'),

-- Vitória Maria L.
((SELECT id FROM patients WHERE full_name = 'Vitória Maria L.'), 'Levodopa/Carbidopa', '250/25mg', '3x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Vitória Maria L.'), 'Sertralina', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Vitória Maria L.'), 'Domperidona', '10mg', '3x ao dia antes das refeições', NULL),

-- Antônio Ximenes B.
((SELECT id FROM patients WHERE full_name = 'Antônio Ximenes B.'), 'Losartana', '100mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Antônio Ximenes B.'), 'Metformina', '850mg', '2x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Antônio Ximenes B.'), 'AAS', '100mg', '1x ao dia', 'Prevenção secundária AVE'),
((SELECT id FROM patients WHERE full_name = 'Antônio Ximenes B.'), 'Sinvastatina', '20mg', '1x ao dia à noite', NULL),

-- Lourdes M.
((SELECT id FROM patients WHERE full_name = 'Lourdes M.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Lourdes M.'), 'Paracetamol', '750mg', '3x ao dia se dor', NULL),
((SELECT id FROM patients WHERE full_name = 'Lourdes M.'), 'Condroitina + Glucosamina', '1200/1500mg', '1x ao dia', NULL),

-- Maria Vitória A.
((SELECT id FROM patients WHERE full_name = 'Maria Vitória A.'), 'Cálcio + Vitamina D', '600mg/400UI', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Vitória A.'), 'Alendronato', '70mg', '1x por semana em jejum', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Vitória A.'), 'Suplemento proteico', '30g', '1x ao dia', 'Whey protein para sarcopenia'),

-- Carlos Antônio R.
((SELECT id FROM patients WHERE full_name = 'Carlos Antônio R.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Carlos Antônio R.'), 'Metformina', '500mg', '2x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Carlos Antônio R.'), 'Insulina NPH', '10UI', '1x ao dia pela manhã', NULL),
((SELECT id FROM patients WHERE full_name = 'Carlos Antônio R.'), 'Omeprazol', '20mg', '1x ao dia em jejum', NULL),

-- Lauriete D.
((SELECT id FROM patients WHERE full_name = 'Lauriete D.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Lauriete D.'), 'Rivastigmina', '3mg', '2x ao dia', 'Para demência vascular'),
((SELECT id FROM patients WHERE full_name = 'Lauriete D.'), 'Diosmina', '500mg', '2x ao dia', 'Insuficiência venosa'),

-- Juvenal da R.
((SELECT id FROM patients WHERE full_name = 'Juvenal da R.'), 'Cálcio + Vitamina D', '600mg/400UI', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Juvenal da R.'), 'Alendronato', '70mg', '1x por semana em jejum', NULL),
((SELECT id FROM patients WHERE full_name = 'Juvenal da R.'), 'Losartana', '50mg', '1x ao dia', NULL),

-- Cryselide de M.
((SELECT id FROM patients WHERE full_name = 'Cryselide de M.'), 'Paracetamol', '750mg', '3x ao dia se dor', NULL),
((SELECT id FROM patients WHERE full_name = 'Cryselide de M.'), 'Losartana', '25mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Cryselide de M.'), 'Ciclobenzaprina', '10mg', '1x ao dia à noite', 'Relaxante muscular'),

-- Maria Carmem F.
((SELECT id FROM patients WHERE full_name = 'Maria Carmem F.'), 'Carvedilol', '12,5mg', '2x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Carmem F.'), 'Furosemida', '40mg', '1x ao dia pela manhã', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Carmem F.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Carmem F.'), 'Varfarina', '5mg', '1x ao dia', 'Controle INR mensal'),

-- Enilda U.
((SELECT id FROM patients WHERE full_name = 'Enilda U.'), 'Alendronato', '70mg', '1x por semana em jejum', NULL),
((SELECT id FROM patients WHERE full_name = 'Enilda U.'), 'Cálcio + Vitamina D', '600mg/400UI', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Enilda U.'), 'Paracetamol', '500mg', 'Se necessário', 'Para artralgia'),

-- Tânia Maria C.
((SELECT id FROM patients WHERE full_name = 'Tânia Maria C.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Tânia Maria C.'), 'Pregabalina', '75mg', '2x ao dia', 'Dor neuropática pós-cirurgia'),
((SELECT id FROM patients WHERE full_name = 'Tânia Maria C.'), 'Paracetamol', '750mg', 'Se necessário', NULL),

-- Terezinha Junqueira P.
((SELECT id FROM patients WHERE full_name = 'Terezinha Junqueira P.'), 'Levodopa/Carbidopa', '100/25mg', '3x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Terezinha Junqueira P.'), 'Sertralina', '25mg', '1x ao dia', NULL),

-- Maria Idete (Creusa) M.
((SELECT id FROM patients WHERE full_name = 'Maria Idete (Creusa) M.'), 'Brometo de Ipratrópio', '0,25mg/mL', '3x ao dia inalação', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Idete (Creusa) M.'), 'Suplemento nutricional (Ensure)', '200mL', '2x ao dia', 'Desnutrição proteica'),

-- Ellen de Azevedo T.
((SELECT id FROM patients WHERE full_name = 'Ellen de Azevedo T.'), 'Losartana', '25mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Ellen de Azevedo T.'), 'Formoterol/Budesonida', '12/400mcg', '2x ao dia inalação', NULL),
((SELECT id FROM patients WHERE full_name = 'Ellen de Azevedo T.'), 'Alprazolam', '0,25mg', '1x ao dia à noite', 'Ansiedade'),

-- Anete U.
((SELECT id FROM patients WHERE full_name = 'Anete U.'), 'Paracetamol', '750mg', '3x ao dia se dor', NULL),
((SELECT id FROM patients WHERE full_name = 'Anete U.'), 'Ciclobenzaprina', '5mg', '1x ao dia à noite', NULL),

-- Teresinha Neves O.
((SELECT id FROM patients WHERE full_name = 'Teresinha Neves O.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Teresinha Neves O.'), 'Paracetamol', '750mg', 'Se necessário', NULL),
((SELECT id FROM patients WHERE full_name = 'Teresinha Neves O.'), 'Omeprazol', '20mg', '1x ao dia em jejum', NULL),

-- José Neto B.
((SELECT id FROM patients WHERE full_name = 'José Neto B.'), 'Losartana', '100mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'José Neto B.'), 'Anlodipino', '5mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'José Neto B.'), 'Metformina', '500mg', '2x ao dia', NULL),

-- Francisco de Assis P.
((SELECT id FROM patients WHERE full_name = 'Francisco de Assis P.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Francisco de Assis P.'), 'AAS', '100mg', '1x ao dia', 'Prevenção secundária'),
((SELECT id FROM patients WHERE full_name = 'Francisco de Assis P.'), 'Sinvastatina', '40mg', '1x ao dia à noite', NULL),
((SELECT id FROM patients WHERE full_name = 'Francisco de Assis P.'), 'Omeprazol', '20mg', '1x ao dia em jejum', NULL),

-- Cleide Machado V.
((SELECT id FROM patients WHERE full_name = 'Cleide Machado V.'), 'Rivastigmina', '4,5mg', '2x ao dia', 'Para demência'),
((SELECT id FROM patients WHERE full_name = 'Cleide Machado V.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Cleide Machado V.'), 'Apixabana', '2,5mg', '2x ao dia', 'Fibrilação atrial'),

-- Maria Gisélia N.
((SELECT id FROM patients WHERE full_name = 'Maria Gisélia N.'), 'Donepezila', '5mg', '1x ao dia', 'Alzheimer estágio inicial'),
((SELECT id FROM patients WHERE full_name = 'Maria Gisélia N.'), 'Losartana', '25mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Gisélia N.'), 'Alendronato', '70mg', '1x por semana em jejum', NULL),

-- Maria Aparecida F.
((SELECT id FROM patients WHERE full_name = 'Maria Aparecida F.'), 'Losartana', '25mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Aparecida F.'), 'Paracetamol', '500mg', 'Se necessário', NULL),

-- Maria Felix R.
((SELECT id FROM patients WHERE full_name = 'Maria Felix R.'), 'Losartana', '50mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Maria Felix R.'), 'Formoterol/Budesonida', '12/400mcg', '2x ao dia inalação', NULL),

-- Antônia D.
((SELECT id FROM patients WHERE full_name = 'Antônia D.'), 'Paracetamol', '750mg', '3x ao dia se dor', NULL),
((SELECT id FROM patients WHERE full_name = 'Antônia D.'), 'Ciclobenzaprina', '10mg', '1x ao dia à noite', NULL),

-- Juracy M.
((SELECT id FROM patients WHERE full_name = 'Juracy M.'), 'Losartana', '25mg', '1x ao dia', NULL),
((SELECT id FROM patients WHERE full_name = 'Juracy M.'), 'Vitamina D', '7.000UI', '1x por semana', NULL);


-- =========================================================================
-- 16. SEED — GERAÇÃO PROGRAMÁTICA DE APPOINTMENTS (90 dias)
-- =========================================================================
-- Gera appointments dos últimos 60 dias até +30 dias futuros.
-- Respeita frequência semanal e distribui em dias úteis.
-- Passados: ~92% completed, ~5% missed, ~3% cancelled.
-- Futuros: todos 'scheduled'.
-- Caso especial: Maria Vitória A. alterna fisio 60% Rayanne / 40% Amanda.

DO $$
DECLARE
  pat RECORD;
  v_amanda_id  UUID := 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002';
  v_rayanne_id UUID := 'a1b2c3d4-e5f6-4a7b-8c9d-000000000003';
  v_fisio_id   UUID;
  v_date       DATE;
  v_start_date DATE;
  v_end_date   DATE;
  v_dow        INTEGER;  -- 0=dom, 1=seg, ..., 6=sab
  v_should     BOOLEAN;
  v_status     status_appointment;
  v_rand       DOUBLE PRECISION;
  v_time       TIME;
  v_checkin    TIMESTAMPTZ;
  v_checkout   TIMESTAMPTZ;
  v_counter    INTEGER;
BEGIN
  v_end_date := CURRENT_DATE + 30;

  FOR pat IN SELECT * FROM patients WHERE status = 'active' LOOP
    -- Iniciar a partir da admissão ou 60 dias atrás, o que for mais recente
    v_start_date := GREATEST(pat.admission_date, CURRENT_DATE - 60);
    v_counter := 0;
    v_date := v_start_date;

    WHILE v_date <= v_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date)::INTEGER;

      -- Pular fins de semana
      IF v_dow IN (0, 6) THEN
        v_date := v_date + 1;
        CONTINUE;
      END IF;

      -- Verificar se o dia corresponde à frequência semanal do paciente
      v_should := FALSE;
      CASE pat.weekly_frequency
        WHEN 5 THEN v_should := TRUE;                     -- seg a sex
        WHEN 4 THEN v_should := v_dow IN (1, 2, 3, 4);   -- seg a qui
        WHEN 3 THEN v_should := v_dow IN (1, 3, 5);       -- seg, qua, sex
        WHEN 2 THEN v_should := v_dow IN (2, 4);           -- ter, qui
        WHEN 1 THEN v_should := v_dow = 3;                 -- qua
        ELSE v_should := FALSE;
      END CASE;

      IF NOT v_should THEN
        v_date := v_date + 1;
        CONTINUE;
      END IF;

      -- Fisio do atendimento (caso especial Maria Vitória: alternado)
      v_fisio_id := pat.primary_fisio_id;
      IF pat.full_name = 'Maria Vitória A.' THEN
        IF v_counter % 5 < 3 THEN
          v_fisio_id := v_rayanne_id;   -- 60% Rayanne
        ELSE
          v_fisio_id := v_amanda_id;    -- 40% Amanda
        END IF;
      END IF;

      -- Horário sugerido (7:30 às 17:00, intervalos de 30min)
      v_time := TIME '07:30' + (floor(random() * 20) * INTERVAL '30 minutes');

      -- Status e timestamps
      IF v_date > CURRENT_DATE THEN
        -- Futuro: apenas agendado
        v_status := 'scheduled';
        v_checkin := NULL;
        v_checkout := NULL;
      ELSE
        -- Passado: distribuir status
        v_rand := random();
        IF v_rand < 0.92 THEN
          v_status := 'completed';
        ELSIF v_rand < 0.97 THEN
          v_status := 'missed';
        ELSE
          v_status := 'cancelled';
        END IF;

        IF v_status = 'completed' THEN
          -- Check-in próximo ao horário agendado (±10min)
          v_checkin := v_date + v_time + ((floor(random() * 20)::INTEGER - 10) * INTERVAL '1 minute');
          -- Sessão entre 40 e 60 minutos
          v_checkout := v_checkin + INTERVAL '40 minutes' + (floor(random() * 20)::INTEGER * INTERVAL '1 minute');
        ELSE
          v_checkin := NULL;
          v_checkout := NULL;
        END IF;
      END IF;

      INSERT INTO appointments (patient_id, fisio_id, scheduled_date, scheduled_time, check_in_at, check_out_at, status)
      VALUES (pat.id, v_fisio_id, v_date, v_time, v_checkin, v_checkout, v_status);

      v_counter := v_counter + 1;
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
END;
$$;


-- =========================================================================
-- 17. SEED — GERAÇÃO PROGRAMÁTICA DE EVOLUÇÕES
-- =========================================================================
-- Para cada appointment com status='completed', gera uma evolução com:
-- - Sinais vitais realistas (PA, FC, SpO2, FR)
-- - Condutas selecionadas do pool coerente com o diagnóstico
-- - Observação narrativa montada por templates (variação por semana do mês)
-- - Intercorrência em ~7% dos casos

DO $$
DECLARE
  appt RECORD;
  -- Sinais vitais
  v_bp_sys_i INTEGER; v_bp_dia_i INTEGER;
  v_bp_sys_f INTEGER; v_bp_dia_f INTEGER;
  v_hr_i INTEGER; v_hr_f INTEGER;
  v_spo2_i INTEGER; v_spo2_f INTEGER;
  v_rr_i INTEGER; v_rr_f INTEGER;
  -- Condutas
  v_pool     TEXT[];
  v_selected TEXT[];
  v_count    INTEGER;
  v_idx      INTEGER;
  -- Observações
  v_obs  TEXT;
  v_week INTEGER;
  -- Intercorrência
  v_has_inter  BOOLEAN;
  v_inter_desc TEXT;
  -- Arrays de templates
  v_arrival       TEXT[];
  v_conduct_text  TEXT[];
  v_response      TEXT[];
  v_clinical_early TEXT[];
  v_clinical_late  TEXT[];
  v_inter_options  TEXT[];
BEGIN
  -- ── Templates de observação ──

  -- Estado de chegada
  v_arrival := ARRAY[
    'Paciente em bom estado geral ao início da sessão.',
    'Paciente apresentou-se estável hemodinamicamente.',
    'Paciente referiu boa disposição para os exercícios do dia.',
    'Paciente relatou boa noite de sono, sem queixas significativas.',
    'Paciente colaborativo(a) e orientado(a) ao início da sessão.',
    'Paciente chegou acompanhado(a) pelo cuidador, sem queixas álgicas.',
    'Paciente referiu leve cansaço matinal, porém sem dor ao início.',
    'Paciente estável, sem intercorrências desde a última sessão.'
  ];

  -- Conduta principal (narrativa)
  v_conduct_text := ARRAY[
    'Realizado protocolo terapêutico conforme planejamento.',
    'Condutas aplicadas de acordo com o plano de tratamento vigente.',
    'Realizados exercícios de fortalecimento e mobilização articular.',
    'Aplicado protocolo de reabilitação conforme evolução clínica do paciente.',
    'Realizada sessão com foco em ganho funcional e independência.',
    'Conduzidos exercícios ativos e passivos conforme tolerância.',
    'Aplicadas técnicas de mobilização, alongamento e fortalecimento.',
    'Realizada cinesioterapia e treino funcional dirigido ao quadro.'
  ];

  -- Resposta do paciente
  v_response := ARRAY[
    'Paciente tolerou bem a sessão sem queixas ao término.',
    'Boa adesão e colaboração durante os exercícios propostos.',
    'Desempenho satisfatório nos exercícios realizados.',
    'Paciente respondeu positivamente às condutas aplicadas.',
    'Manteve bom padrão respiratório durante toda a sessão.',
    'Apresentou leve fadiga ao final, dentro do esperado para o quadro.',
    'Colaborou ativamente durante toda a sessão de tratamento.',
    'Boa tolerância ao esforço durante as atividades terapêuticas.'
  ];

  -- Observação clínica — semanas 1-2 (adaptação / rotina)
  v_clinical_early := ARRAY[
    'Manter condutas atuais e monitorar resposta terapêutica.',
    'Fase de adaptação ao protocolo. Sinais vitais estáveis ao final.',
    'Ajustar intensidade conforme tolerância nas próximas sessões.',
    'Em fase inicial do ciclo mensal. Progresso dentro do esperado.'
  ];

  -- Observação clínica — semanas 3-4 (ganhos / manutenção)
  v_clinical_late := ARRAY[
    'Observada melhora progressiva da mobilidade funcional.',
    'Evolução positiva no condicionamento geral. Manter protocolo.',
    'Ganhos funcionais evidentes neste período. Prosseguir com plano.',
    'Paciente apresenta ganhos de força e equilíbrio consistentes.'
  ];

  -- Descrições de intercorrência
  v_inter_options := ARRAY[
    'PA elevada no início (>160x100mmHg). Conduta adaptada com exercícios de menor intensidade e monitoramento.',
    'Paciente relatou dor intensa durante exercício resistido. Sessão modificada para condutas passivas e analgésicas.',
    'Fadiga excessiva após 20 minutos de sessão. Encerrada antes do previsto com orientações de repouso.',
    'Paciente recusou exercícios de bipedestação por indisposição geral. Mantidas condutas em decúbito.',
    'Episódio de tontura durante mudança de decúbito. Monitorado, estabilizado, sessão adaptada.',
    'Queda de SpO2 para 89% durante exercício ativo. Necessário repouso e monitoramento até estabilização.',
    'Paciente referiu cefaleia intensa no início da sessão. Sessão adaptada com condutas leves e orientações.',
    'Familiar relatou queda no dia anterior. Sessão adaptada para avaliação de dano e condutas preventivas.'
  ];

  -- ── Iterar sobre cada appointment completed ──

  FOR appt IN
    SELECT a.id AS appt_id, a.patient_id, a.fisio_id, a.scheduled_date, a.check_out_at,
           p.primary_diagnosis
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.status = 'completed'
    ORDER BY a.scheduled_date
  LOOP

    -- ── Selecionar pool de condutas baseado no diagnóstico principal ──

    IF appt.primary_diagnosis ILIKE '%DPOC%'
       OR appt.primary_diagnosis ILIKE '%respirat%'
       OR appt.primary_diagnosis ILIKE '%pneumonia%' THEN
      v_pool := ARRAY[
        'MHB', 'RPPI', 'Terapia pressórica', 'Fortalecimento inspiratório',
        'RTA', 'Cinesio ativa', 'Alongamento', 'Oxigenoterapia',
        'Shaker/Acapella/aerobika', 'Bipedestação'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%AVE%'
          OR appt.primary_diagnosis ILIKE '%hemiparesia%' THEN
      v_pool := ARRAY[
        'Cinesio passiva', 'Cinesio ativa-assistida', 'Cinesio ativa',
        'Treino de equilíbrio', 'Treino de marcha', 'Alongamento',
        'Treino de transferências', 'Bipedestação', 'Posicionamento', 'Sedestação BL'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%Parkinson%'
          OR appt.primary_diagnosis ILIKE '%bradicinesia%' THEN
      v_pool := ARRAY[
        'Cinesio ativa', 'Cinesio ativa-assistida', 'Treino de equilíbrio',
        'Treino de marcha', 'Alongamento', 'Atividades cognitivas',
        'Treino de transferências', 'Bipedestação', 'Cinesio resistida'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%demência%'
          OR appt.primary_diagnosis ILIKE '%Alzheimer%' THEN
      v_pool := ARRAY[
        'Cinesio ativa-assistida', 'Cinesio passiva', 'Treino de equilíbrio',
        'Alongamento', 'Atividades cognitivas', 'Sedestação BL',
        'Bipedestação', 'Posicionamento', 'Poltrona'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%fratura%'
          OR appt.primary_diagnosis ILIKE '%PTQ%' THEN
      v_pool := ARRAY[
        'Cinesio ativa', 'Cinesio resistida', 'Treino de marcha',
        'Treino de equilíbrio', 'Alongamento', 'Treino de transferências',
        'TENS/US/Laser/FES', 'Bipedestação', 'Cicloergômetro'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%lombalgia%'
          OR appt.primary_diagnosis ILIKE '%coluna%'
          OR appt.primary_diagnosis ILIKE '%cervicalgia%'
          OR appt.primary_diagnosis ILIKE '%postural%' THEN
      v_pool := ARRAY[
        'Alongamento', 'Cinesio ativa', 'Cinesio resistida',
        'TENS/US/Laser/FES', 'Posicionamento', 'Orientações',
        'Treino de equilíbrio', 'Cicloergômetro'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%imobilismo%' THEN
      v_pool := ARRAY[
        'Cinesio passiva', 'Cinesio ativa-assistida', 'Cinesio ativa',
        'Sedestação BL', 'Bipedestação', 'Treino de transferências',
        'Alongamento', 'Posicionamento', 'Poltrona'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%sarcopenia%'
          OR appt.primary_diagnosis ILIKE '%fragilidade%' THEN
      v_pool := ARRAY[
        'Cinesio ativa', 'Cinesio resistida', 'Treino de equilíbrio',
        'Treino de marcha', 'Alongamento', 'Bipedestação',
        'Cicloergômetro', 'Orientações'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%osteoartrose%' THEN
      v_pool := ARRAY[
        'Cinesio ativa', 'Cinesio resistida', 'Alongamento',
        'TENS/US/Laser/FES', 'Treino de marcha', 'Treino de equilíbrio',
        'Cicloergômetro', 'Orientações'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%osteoporose%' THEN
      v_pool := ARRAY[
        'Cinesio ativa', 'Cinesio resistida', 'Treino de equilíbrio',
        'Treino de marcha', 'Alongamento', 'Bipedestação', 'Orientações'
      ];

    ELSIF appt.primary_diagnosis ILIKE '%cardíaca%'
          OR appt.primary_diagnosis ILIKE '%hipertensão%' THEN
      v_pool := ARRAY[
        'Cicloergômetro', 'RTA', 'Cinesio ativa', 'Alongamento',
        'Orientações', 'Bipedestação', 'Treino de marcha'
      ];

    ELSE
      -- Manutenção / idoso ativo / outros
      v_pool := ARRAY[
        'Cinesio ativa', 'Alongamento', 'Treino de equilíbrio',
        'Treino de marcha', 'Orientações', 'Bipedestação',
        'Cicloergômetro', 'Cinesio resistida'
      ];
    END IF;

    -- ── Sortear 3-5 condutas do pool ──
    v_count := 3 + floor(random() * 3)::INTEGER;
    IF v_count > array_length(v_pool, 1) THEN
      v_count := array_length(v_pool, 1);
    END IF;

    v_selected := ARRAY[]::TEXT[];
    WHILE COALESCE(array_length(v_selected, 1), 0) < v_count LOOP
      v_idx := 1 + floor(random() * array_length(v_pool, 1))::INTEGER;
      IF array_position(v_selected, v_pool[v_idx]) IS NULL THEN
        v_selected := array_append(v_selected, v_pool[v_idx]);
      END IF;
    END LOOP;

    -- ── Gerar sinais vitais realistas ──
    v_bp_sys_i := 110 + floor(random() * 50)::INTEGER;    -- 110-159
    v_bp_dia_i := 60  + floor(random() * 30)::INTEGER;    -- 60-89
    v_bp_sys_f := GREATEST(100, v_bp_sys_i + floor(random() * 10)::INTEGER - 5);
    v_bp_dia_f := GREATEST(55,  v_bp_dia_i + floor(random() * 10)::INTEGER - 5);

    v_hr_i := 60 + floor(random() * 35)::INTEGER;         -- 60-94
    v_hr_f := GREATEST(55, v_hr_i + floor(random() * 10)::INTEGER - 5);

    v_spo2_i := 93 + floor(random() * 6)::INTEGER;        -- 93-98
    v_spo2_f := LEAST(99, v_spo2_i + floor(random() * 3)::INTEGER);

    v_rr_i := 14 + floor(random() * 8)::INTEGER;          -- 14-21
    v_rr_f := GREATEST(12, v_rr_i + floor(random() * 4)::INTEGER - 2);

    -- ── Semana do mês para variação de tom ──
    v_week := LEAST(4, CEIL(EXTRACT(DAY FROM appt.scheduled_date) / 7.0)::INTEGER);

    -- ── Montar observação narrativa ──
    v_obs := v_arrival[1 + floor(random() * array_length(v_arrival, 1))::INTEGER]
      || ' ' || v_conduct_text[1 + floor(random() * array_length(v_conduct_text, 1))::INTEGER]
      || ' ' || v_response[1 + floor(random() * array_length(v_response, 1))::INTEGER];

    IF v_week <= 2 THEN
      v_obs := v_obs || ' ' || v_clinical_early[1 + floor(random() * array_length(v_clinical_early, 1))::INTEGER];
    ELSE
      v_obs := v_obs || ' ' || v_clinical_late[1 + floor(random() * array_length(v_clinical_late, 1))::INTEGER];
    END IF;

    -- ── Intercorrência (~7% das sessões) ──
    v_has_inter := random() < 0.07;
    IF v_has_inter THEN
      v_inter_desc := v_inter_options[1 + floor(random() * array_length(v_inter_options, 1))::INTEGER];
    ELSE
      v_inter_desc := NULL;
    END IF;

    -- ── Inserir evolução ──
    INSERT INTO evolutions (
      appointment_id, patient_id, fisio_id,
      bp_initial, bp_final,
      hr_initial, hr_final,
      spo2_initial, spo2_final,
      rr_initial, rr_final,
      conducts, observations,
      had_intercurrence, intercurrence_description,
      created_at
    ) VALUES (
      appt.appt_id, appt.patient_id, appt.fisio_id,
      v_bp_sys_i || 'x' || v_bp_dia_i,
      v_bp_sys_f || 'x' || v_bp_dia_f,
      v_hr_i, v_hr_f,
      v_spo2_i, v_spo2_f,
      v_rr_i, v_rr_f,
      v_selected,
      v_obs,
      v_has_inter,
      v_inter_desc,
      appt.check_out_at   -- created_at = momento do check-out do appointment
    );

  END LOOP;
END;
$$;


-- =========================================================================
-- 18. VINCULAÇÃO PROFILE × AUTH USER
-- =========================================================================
-- INSTRUÇÕES PARA O TECH LEAD:
--
-- 1. Acesse o painel do Supabase: Authentication > Users > Add user
-- 2. Crie cada um dos 6 usuários abaixo com senha padrão (ex: Ative60@2026)
-- 3. DESMARQUE "Send email confirmation" para ativar imediatamente
-- 4. Após criar todos os 6, DESCOMENTE o bloco abaixo e execute no SQL Editor
--
-- ┌─────────────────────────────────┬─────────────────────┬────────┐
-- │ E-mail                          │ Nome                │ Função │
-- ├─────────────────────────────────┼─────────────────────┼────────┤
-- │ guilherme@somosdom.io           │ Guilherme Duarte    │ gestao │
-- │ amanda@ativemais60.com.br       │ Amanda Cardoso      │ gestao │
-- │ rayanne@ativemais60.com.br      │ Rayanne Paiva       │ gestao │
-- │ ismenia@ativemais60.com.br      │ Ismênia Pereira     │ fisio  │
-- │ libia@ativemais60.com.br        │ Líbia               │ fisio  │
-- │ kivia@ativemais60.com.br        │ Kívia               │ fisio  │
-- └─────────────────────────────────┴─────────────────────┴────────┘
--
-- O script abaixo atualiza profiles.id para coincidir com auth.users.id.
-- As FKs com ON UPDATE CASCADE propagam automaticamente para:
--   patients.primary_fisio_id, appointments.fisio_id, evolutions.fisio_id

/*
DO $$
DECLARE
  v_auth_id UUID;
  v_old_id  UUID;
  v_emails  TEXT[] := ARRAY[
    'guilherme@somosdom.io',
    'amanda@ativemais60.com.br',
    'rayanne@ativemais60.com.br',
    'ismenia@ativemais60.com.br',
    'libia@ativemais60.com.br',
    'kivia@ativemais60.com.br'
  ];
  v_email TEXT;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_auth_id FROM auth.users WHERE email = v_email;
    SELECT id INTO v_old_id  FROM profiles   WHERE email = v_email;

    IF v_auth_id IS NOT NULL AND v_old_id IS NOT NULL AND v_auth_id != v_old_id THEN
      UPDATE profiles SET id = v_auth_id WHERE id = v_old_id;
      RAISE NOTICE 'Vinculado: % (profile % -> auth %)', v_email, v_old_id, v_auth_id;
    ELSIF v_auth_id IS NULL THEN
      RAISE WARNING 'Auth user não encontrado para: %. Crie o usuário antes.', v_email;
    END IF;
  END LOOP;
END;
$$;
*/


-- =========================================================================
-- FIM DO SCHEMA_SUPABASE.sql
-- =========================================================================
-- Resumo gerado:
--   Tabelas:     7 (profiles, patients, medications, appointments, evolutions, exams, monthly_reports)
--   Profiles:    6 (3 gestão + 3 fisio)
--   Pacientes:   28
--   Medicamentos: ~80 registros
--   Appointments: ~880 (estimado, varia com CURRENT_DATE)
--   Evoluções:   ~540 (estimado, ~92% dos appointments passados)
--   Políticas RLS: 21
--   Índices:     11
--   Funções:     1 (is_gestao)
-- =========================================================================
