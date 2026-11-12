const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[0-9a-f]{32,64}$/;
const SHA = /^[0-9a-f]{64}$/;

// Checks an authenticated snapshot inventory against the binary manifest.
// It cannot establish that inventory.json was exported from database.dump;
// the producer must prove both came from one PostgreSQL snapshot.
export function verifyBackupInventory(manifest, inventory) {
  if (
    !inventory ||
    inventory.version !== 1 ||
    inventory.snapshotAt !== manifest.snapshotAt ||
    inventory.databaseSha256 !== manifest.database.sha256 ||
    !Array.isArray(inventory.files) ||
    !Array.isArray(inventory.versions) ||
    !Array.isArray(inventory.bindings) ||
    inventory.files.length > 100_000 ||
    inventory.versions.length > 100_000 ||
    inventory.bindings.length > 200_000
  )
    throw new Error("BACKUP_INVENTORY_INVALID");
  const objects = new Map(manifest.objects.map((item) => [item.key, item]));
  const files = new Map();
  const used = new Set();
  for (const file of inventory.files) {
    if (
      !file ||
      !UUID.test(file.id) ||
      !UUID.test(file.clinicId) ||
      !KEY.test(file.key) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !SHA.test(file.sha256) ||
      files.has(file.id) ||
      used.has(file.key)
    )
      throw new Error("BACKUP_INVENTORY_INVALID");
    const object = objects.get(file.key);
    if (!object || object.bytes !== file.bytes || object.sha256 !== file.sha256)
      throw new Error("BACKUP_INVENTORY_MISMATCH");
    files.set(file.id, file);
    used.add(file.key);
  }
  if (used.size !== objects.size) throw new Error("BACKUP_INVENTORY_MISMATCH");
  const versions = new Map();
  for (const version of inventory.versions) {
    if (
      !version ||
      !UUID.test(version.id) ||
      !UUID.test(version.clinicId) ||
      versions.has(version.id)
    )
      throw new Error("BACKUP_INVENTORY_INVALID");
    versions.set(version.id, version);
  }
  const bindings = new Set();
  for (const binding of inventory.bindings) {
    if (
      !binding ||
      !UUID.test(binding.fileId) ||
      !UUID.test(binding.versionId) ||
      !UUID.test(binding.clinicId)
    )
      throw new Error("BACKUP_INVENTORY_INVALID");
    const file = files.get(binding.fileId),
      version = versions.get(binding.versionId);
    if (
      !file ||
      !version ||
      file.clinicId !== binding.clinicId ||
      version.clinicId !== binding.clinicId
    )
      throw new Error("BACKUP_INVENTORY_MISMATCH");
    const identity = binding.versionId + ":" + binding.fileId;
    if (bindings.has(identity)) throw new Error("BACKUP_INVENTORY_INVALID");
    bindings.add(identity);
  }
  return { fileCount: files.size, bindingCount: bindings.size };
}
