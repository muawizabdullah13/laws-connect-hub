
CREATE POLICY "Admin manages case files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'case-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'case-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Associates read case files on assigned cases" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND public.is_assigned_to_case(d.case_id, auth.uid())
    )
  );
