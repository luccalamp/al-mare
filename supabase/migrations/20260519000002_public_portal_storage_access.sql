-- Permitir acesso público às fotos do cliente via portal
-- Esta política permite que URLs públicas funcionem para fotos de clientes
-- quando acessadas através do portal do cliente

CREATE POLICY "public_portal_anamnese_fotos_select" ON storage.objects
	FOR SELECT TO anon
	USING (
		bucket_id = 'anamnese-fotos'
		AND EXISTS (
			SELECT 1
			FROM public.clientes AS client
			WHERE client.id = NULLIF(split_part(storage.objects.name, '/', 1), '')::UUID
				AND client.portal_active = TRUE
				AND client.deleted_at IS NULL
		)
	);
