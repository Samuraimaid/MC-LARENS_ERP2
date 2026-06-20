import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { ROLES } from "./utils";

let _cached = null;

export function useRoles() {
  const [roles, setRoles] = useState(_cached || ROLES);

  useEffect(() => {
    if (_cached) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/roles`, { withCredentials: true });
        if (res?.data) {
          _cached = res.data;
          setRoles(res.data);
        }
      } catch (e) {
        // ignore, keep fallback
      }
    })();
  }, []);

  return roles;
}
