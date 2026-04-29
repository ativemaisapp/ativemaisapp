-- =========================================================================
-- TABELAS FINANCEIRAS — billing_status + payroll_status
-- =========================================================================
-- Execute no SQL Editor do Supabase.
-- Controle gerencial de cobranças (pacientes) e repasses (fisios).

-- Tabela de status de cobrança por paciente/mês
CREATE TABLE billing_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'paid')) DEFAULT 'open',
  marked_paid_at TIMESTAMPTZ,
  marked_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, reference_month)
);

ALTER TABLE billing_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_select" ON billing_status FOR SELECT TO authenticated USING (is_gestao());
CREATE POLICY "billing_insert" ON billing_status FOR INSERT TO authenticated WITH CHECK (is_gestao());
CREATE POLICY "billing_update" ON billing_status FOR UPDATE TO authenticated USING (is_gestao());
CREATE POLICY "billing_delete" ON billing_status FOR DELETE TO authenticated USING (is_gestao());

-- Tabela de status de repasse por fisio/mês
CREATE TABLE payroll_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fisio_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'paid')) DEFAULT 'open',
  marked_paid_at TIMESTAMPTZ,
  marked_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fisio_id, reference_month)
);

ALTER TABLE payroll_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_select" ON payroll_status FOR SELECT TO authenticated USING (is_gestao());
CREATE POLICY "payroll_insert" ON payroll_status FOR INSERT TO authenticated WITH CHECK (is_gestao());
CREATE POLICY "payroll_update" ON payroll_status FOR UPDATE TO authenticated USING (is_gestao());
CREATE POLICY "payroll_delete" ON payroll_status FOR DELETE TO authenticated USING (is_gestao());

-- Índices
CREATE INDEX idx_billing_patient_month ON billing_status(patient_id, reference_month);
CREATE INDEX idx_payroll_fisio_month ON payroll_status(fisio_id, reference_month);
