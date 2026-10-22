-- A missing marker means no historical reading is known. Never infer a read from
-- message delivery or current conversation sequence.
INSERT INTO public.conversation_reads(conversation_id,side,last_read_seq)
SELECT c.id, sides.side, 0
FROM public.conversations c
CROSS JOIN (VALUES ('clinic'::text),('laboratory'::text)) AS sides(side)
WHERE NOT EXISTS (
    SELECT 1 FROM public.conversation_reads existing
    WHERE existing.conversation_id=c.id AND existing.side=sides.side
)
ON CONFLICT (conversation_id,side) DO NOTHING;
