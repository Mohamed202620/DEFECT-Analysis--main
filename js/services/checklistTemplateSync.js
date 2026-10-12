const CHECKLIST_TEMPLATE_COLLECTIONS = new Set(["machineAmTemplates", "fiveSTemplates"]);

export function buildChecklistTemplateDocument(action, currentData = null) {
  const { collection, targetId, items, loadedVersion, updatedAt, updatedBy } = action || {};
  if (!CHECKLIST_TEMPLATE_COLLECTIONS.has(collection) || !targetId || !Array.isArray(items)) {
    throw new Error("Invalid checklist template action");
  }

  const expectedVersion = Number(loadedVersion || 0);
  const currentVersion = currentData
    ? Number(currentData.templateVersion || 1)
    : 0;
  if (currentVersion > expectedVersion) {
    throw new Error("Checklist version conflict: the template changed while offline");
  }

  const history = Array.isArray(currentData?.history) ? currentData.history.slice(-9) : [];
  history.push({
    version: expectedVersion,
    updatedAt,
    updatedBy,
    itemsCount: items.length
  });

  return {
    items,
    templateVersion: Math.max(currentVersion, expectedVersion) + 1,
    history,
    updatedAt,
    updatedBy
  };
}
