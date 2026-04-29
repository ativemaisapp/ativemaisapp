-- =========================================================================
-- STORAGE POLICIES — Bucket "paciente-arquivos"
-- =========================================================================
-- Execute no SQL Editor do Supabase APÓS criar o bucket manualmente:
-- Storage > Create new bucket > paciente-arquivos (Private, 5MB, image/png, image/jpeg, application/pdf)
--
-- Regras:
-- - Gestão pode ler, inserir e deletar arquivos de TODOS os pacientes
-- - Fisio pode ler arquivos apenas dos pacientes vinculados (primary_fisio_id)
-- - Ninguém pode atualizar arquivos (apenas insert + delete)

-- Habilitar RLS no bucket
-- (Já é habilitado por padrão em buckets privados)

-- SELECT (download): gestão vê tudo, fisio vê dos próprios pacientes
CREATE POLICY "paciente_arquivos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'paciente-arquivos'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'gestao'
      )
      OR EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id::text = (storage.foldername(name))[1]
        AND patients.primary_fisio_id = auth.uid()
      )
    )
  );

-- INSERT (upload): gestão pode fazer upload para qualquer paciente
CREATE POLICY "paciente_arquivos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'paciente-arquivos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );

-- DELETE: gestão pode remover qualquer arquivo
CREATE POLICY "paciente_arquivos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'paciente-arquivos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );


-- =========================================================================
-- STORAGE POLICIES — Bucket "relatorios-mensais"
-- =========================================================================
-- Criar bucket: Storage > New bucket > relatorios-mensais (Private, 10MB, application/pdf)

CREATE POLICY "relatorios_mensais_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'relatorios-mensais'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );

CREATE POLICY "relatorios_mensais_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'relatorios-mensais'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );

CREATE POLICY "relatorios_mensais_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'relatorios-mensais'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );

CREATE POLICY "relatorios_mensais_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'relatorios-mensais'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestao'
    )
  );
