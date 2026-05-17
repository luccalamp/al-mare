REVOKE ALL ON FUNCTION public.issue_pre_consultation_link(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_pre_consultation_link(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.issue_pre_consultation_link(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.issue_pre_consultation_link(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_pre_consultation_link(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_pre_consultation_link(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.deactivate_pre_consultation_link(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_pre_consultation_link(UUID) TO service_role;