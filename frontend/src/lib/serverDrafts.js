import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const FLOW_ALIASES = {
  sale: "sale",
  sales: "sale",
  quotation: "quotation",
  quotations: "quotation",
  quote: "quotation",
};

function normalizeFlow(flow) {
  const normalized = FLOW_ALIASES[String(flow || "").trim().toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported draft flow: ${flow}`);
  }
  return normalized;
}

export async function fetchServerDraftBundle(flow) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.get(`${API}/drafts/${normalizedFlow}`, { withCredentials: true });
  const drafts = Array.isArray(response?.data?.drafts) ? response.data.drafts : [];
  return {
    flow: normalizedFlow,
    drafts,
    activeDraftId: response?.data?.active_draft_id || null,
  };
}

export async function saveServerDraft(flow, draftId, payload = {}) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.put(
    `${API}/drafts/${normalizedFlow}/${encodeURIComponent(draftId)}`,
    {
      name: payload.name || null,
      snapshot: payload.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : {},
    },
    { withCredentials: true }
  );
  return response?.data || null;
}

export async function deleteServerDraft(flow, draftId) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.delete(`${API}/drafts/${normalizedFlow}/${encodeURIComponent(draftId)}`, {
    withCredentials: true,
  });
  return response?.data || null;
}

export async function setServerDraftActive(flow, activeDraftId) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.put(
    `${API}/drafts/${normalizedFlow}/state`,
    { active_draft_id: activeDraftId || null },
    { withCredentials: true }
  );
  return response?.data || null;
}

export async function watchServerDraft(flow, draftId) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.post(
    `${API}/drafts/${normalizedFlow}/${encodeURIComponent(draftId)}/review/watch`,
    null,
    { withCredentials: true }
  );
  return response?.data || null;
}

export async function unwatchServerDraft(flow, draftId) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.post(
    `${API}/drafts/${normalizedFlow}/${encodeURIComponent(draftId)}/review/unwatch`,
    null,
    { withCredentials: true }
  );
  return response?.data || null;
}

export async function releaseServerDraft(flow, draftId) {
  const normalizedFlow = normalizeFlow(flow);
  const response = await axios.post(
    `${API}/drafts/${normalizedFlow}/${encodeURIComponent(draftId)}/review/release`,
    null,
    { withCredentials: true }
  );
  return response?.data || null;
}