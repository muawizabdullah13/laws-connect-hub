
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_assigned_to_case(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = _case_id AND user_id = _user_id) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_assigned_to_case(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_assigned_to_case(uuid, uuid) TO authenticated, service_role;

-- Drop public policies that reference public.* helpers
DROP POLICY IF EXISTS "Admin all assignments" ON public.case_assignments;
DROP POLICY IF EXISTS "Associate sees own assignments" ON public.case_assignments;
DROP POLICY IF EXISTS "Admin all cases" ON public.cases;
DROP POLICY IF EXISTS "Associate sees assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Admin all documents" ON public.documents;
DROP POLICY IF EXISTS "Associate sees docs on assigned cases" ON public.documents;
DROP POLICY IF EXISTS "Admin all hearings" ON public.hearings;
DROP POLICY IF EXISTS "Associate sees hearings on assigned cases" ON public.hearings;
DROP POLICY IF EXISTS "Admin inserts profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin updates any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Associate sees own/assigned-case tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;

-- Drop storage policies that reference public.* helpers
DROP POLICY IF EXISTS "Admin manages case files" ON storage.objects;
DROP POLICY IF EXISTS "Associates read case files on assigned cases" ON storage.objects;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_assigned_to_case(uuid, uuid);

-- Recreate policies
CREATE POLICY "Admin all assignments" ON public.case_assignments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associate sees own assignments" ON public.case_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin all cases" ON public.cases
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associate sees assigned cases" ON public.cases
  FOR SELECT TO authenticated USING (private.is_assigned_to_case(id, auth.uid()));

CREATE POLICY "Admin inserts profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR id = auth.uid());
CREATE POLICY "Admin updates any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin all tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associate sees own/assigned-case tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR (case_id IS NOT NULL AND private.is_assigned_to_case(case_id, auth.uid())));
CREATE POLICY "Associate inserts tasks on assigned cases" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (case_id IS NOT NULL AND private.is_assigned_to_case(case_id, auth.uid()));
CREATE POLICY "Associate updates own/assigned-case tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR (case_id IS NOT NULL AND private.is_assigned_to_case(case_id, auth.uid())))
  WITH CHECK (assigned_to = auth.uid() OR (case_id IS NOT NULL AND private.is_assigned_to_case(case_id, auth.uid())));
CREATE POLICY "Associate deletes own tasks" ON public.tasks
  FOR DELETE TO authenticated USING (assigned_to = auth.uid());

CREATE POLICY "Admin all hearings" ON public.hearings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associate sees hearings on assigned cases" ON public.hearings
  FOR SELECT TO authenticated USING (private.is_assigned_to_case(case_id, auth.uid()));
CREATE POLICY "Associate inserts hearings on assigned cases" ON public.hearings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_assigned_to_case(case_id, auth.uid()));
CREATE POLICY "Associate updates hearings on assigned cases" ON public.hearings
  FOR UPDATE TO authenticated
  USING (private.is_assigned_to_case(case_id, auth.uid()))
  WITH CHECK (private.is_assigned_to_case(case_id, auth.uid()));

CREATE POLICY "Admin all documents" ON public.documents
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associate sees docs on assigned cases" ON public.documents
  FOR SELECT TO authenticated USING (private.is_assigned_to_case(case_id, auth.uid()));
CREATE POLICY "Associate uploads docs on assigned cases" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (private.is_assigned_to_case(case_id, auth.uid()));

-- Storage policies for case-documents bucket
CREATE POLICY "Admin manages case files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'case-documents' AND private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'case-documents' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Associates read case files on assigned cases" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents' AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND private.is_assigned_to_case(d.case_id, auth.uid())
    )
  );
CREATE POLICY "Associates upload case files on assigned cases" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents' AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND private.is_assigned_to_case(d.case_id, auth.uid())
    )
  );
