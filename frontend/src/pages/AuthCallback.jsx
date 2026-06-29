import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";
import { getRoleHomePath } from "@/lib/roleHome";

export function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { processSession } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const params = new URLSearchParams(hash.replace("#", ""));
        const sessionId = params.get("session_id");

        if (!sessionId) {
          console.error("No session_id found");
          navigate("/login", { replace: true });
          return;
        }

        // Process the session
        const user = await processSession(sessionId);
        
        navigate(getRoleHomePath(user?.role), { replace: true, state: { user } });
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/login", { replace: true });
      }
    };

    processAuth();
  }, [location, navigate, processSession]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Verificando sesión...</p>
      </div>
    </div>
  );
}
