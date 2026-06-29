import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export async function fetchLabelPrinterSetup() {
  const response = await axios.get(`${API}/system-settings/label-printer/setup`, {
    withCredentials: true,
  });
  return response.data;
}

export async function refreshLabelPrinterStatus() {
  const response = await axios.get(`${API}/system-settings/label-printer/status`, {
    withCredentials: true,
  });
  return response.data;
}

export async function installLabelPrinterStartupTask(payload = {}) {
  const response = await axios.post(
    `${API}/system-settings/label-printer/install-startup-task`,
    payload,
    { withCredentials: true }
  );
  return response.data;
}

export async function printLabelPrinterTest(payload = {}) {
  const response = await axios.post(
    `${API}/system-settings/label-printer/test-print`,
    payload,
    { withCredentials: true }
  );
  return response.data;
}