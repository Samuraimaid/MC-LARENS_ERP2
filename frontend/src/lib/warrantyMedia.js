import axios from "axios";
import { buildApiUrl } from "@/lib/runtimeApi";

export function localWarrantyMediaUrl(imageId) {
  return buildApiUrl(`/warranties/media/${imageId}`);
}

export async function resolveCrossBranchMediaUrl(imageId, branchId = null) {
  const response = await axios.get(buildApiUrl(`/warranties/media/${imageId}/resolve`), {
    params: branchId ? { branch_id: branchId } : undefined,
    withCredentials: true,
  });
  return response.data?.proxy_url || localWarrantyMediaUrl(imageId);
}

export async function uploadWarrantyEvidence(file, claimId = null) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(
    buildApiUrl("/warranties/media/upload"),
    formData,
    {
      params: claimId ? { claim_id: claimId } : undefined,
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}