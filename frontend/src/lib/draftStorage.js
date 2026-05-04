export function loadLocalDraftState(listKey, activeKey) {
  if (typeof window === "undefined") {
    return { draftTabs: [], activeDraftId: null };
  }
  try {
    const storedTabs = JSON.parse(window.localStorage.getItem(listKey) || "[]");
    const storedActive = window.localStorage.getItem(activeKey);
    return {
      draftTabs: Array.isArray(storedTabs) ? storedTabs : [],
      activeDraftId: storedActive || (storedTabs?.[0]?.id ?? null),
    };
  } catch (error) {
    return { draftTabs: [], activeDraftId: null };
  }
}

export function mirrorServerDraftsToLocalStorage({
  listKey,
  activeKey,
  draftKeyPrefix,
  drafts,
  activeDraftId,
  allowEmptyOverwrite = false,
}) {
  if (typeof window === "undefined") return;

  const serverDrafts = Array.isArray(drafts) ? drafts : [];
  if (!allowEmptyOverwrite && serverDrafts.length === 0) {
    return;
  }

  const existingKeys = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(draftKeyPrefix)) {
      existingKeys.push(key);
    }
  }

  existingKeys.forEach((key) => window.localStorage.removeItem(key));

  const tabs = serverDrafts.map((draft, index) => ({
    id: draft.id,
    name: draft.name || `Borrador ${index + 1}`,
    updatedAt: draft.updatedAt || new Date().toISOString(),
  }));

  window.localStorage.setItem(listKey, JSON.stringify(tabs));
  if (activeDraftId) {
    window.localStorage.setItem(activeKey, activeDraftId);
  } else {
    window.localStorage.removeItem(activeKey);
  }

  serverDrafts.forEach((draft) => {
    if (!draft?.id) return;
    window.localStorage.setItem(`${draftKeyPrefix}${draft.id}`, JSON.stringify(draft.snapshot || {}));
  });
}