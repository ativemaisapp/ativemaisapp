-- STORAGE POLICIES — Bucket "relatorios-mensais"
-- Executar APÓS criar o bucket: Storage > New bucket > relatorios-mensais (Private, 10MB)

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
