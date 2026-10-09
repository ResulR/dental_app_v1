-- Contrôle positif technique ; aucune table conservée après succès.
CREATE TABLE public.dental_lab_atomicity_success_probe_2_6 (id integer PRIMARY KEY);
INSERT INTO public.dental_lab_atomicity_success_probe_2_6 (id) VALUES (1);
SELECT 1 / CASE WHEN count(*) = 1 THEN 1 ELSE 0 END
FROM public.dental_lab_atomicity_success_probe_2_6;
DROP TABLE public.dental_lab_atomicity_success_probe_2_6;
