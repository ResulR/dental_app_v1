import type { DatabaseExecutor } from "../../shared/database.js";
// A version belongs to one aggregate. This helper performs no authorization itself.
export async function readEditVersion(
  tx: DatabaseExecutor,
  orderId: string,
  versionId: string,
) {
  const rows = await tx.query(
    `SELECT v.id,v.material_snapshot_id,v.shade_snapshot_id,v.work_type_snapshot_id,m.reference_id AS material_id,s.reference_id AS shade_id,w.reference_id AS work_type_id,m.label AS material,s.label AS shade,w.label AS work_type,
 jsonb_strip_nulls(jsonb_build_object('first_name',v.patient_first_name,'last_name',v.patient_last_name,'internal_reference',v.patient_reference)) AS patient,
 to_char(v.requested_delivery_date,'YYYY-MM-DD') AS requested_delivery_date,v.description,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('fdi',t.fdi,'selection',t.selection) ORDER BY t.fdi) FROM public.order_version_teeth t WHERE t.version_id=v.id),'[]'::jsonb) AS teeth,
 (SELECT count(*)::integer FROM public.order_version_files f WHERE f.version_id=v.id) AS file_count
 FROM public.order_versions v JOIN public.catalog_reference_snapshots m ON m.id=v.material_snapshot_id JOIN public.catalog_reference_snapshots s ON s.id=v.shade_snapshot_id LEFT JOIN public.catalog_reference_snapshots w ON w.id=v.work_type_snapshot_id WHERE v.order_id=$1 AND v.id=$2`,
    [orderId, versionId],
  );
  return rows.rows[0];
}
export function editableInput(v: Record<string, unknown>) {
  return {
    patient: v.patient,
    requested_delivery_date: v.requested_delivery_date,
    material_id: v.material_id,
    shade_id: v.shade_id,
    ...(v.work_type_snapshot_id ? { work_type_id: v.work_type_id } : {}),
    description: v.description ?? "",
    teeth: v.teeth,
    file_ids: [],
  };
}
