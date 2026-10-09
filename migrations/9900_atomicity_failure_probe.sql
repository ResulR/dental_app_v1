-- Fixture technique réservée à la revue et au test administrateur 2.6.
CREATE TABLE public.dental_lab_atomicity_failure_probe_2_6 (id integer PRIMARY KEY);
INSERT INTO public.dental_lab_atomicity_failure_probe_2_6 (id) VALUES (1);
SELECT 1 / 0;
