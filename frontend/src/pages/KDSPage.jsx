import React from "react";
import { Navigate } from "react-router-dom";

/** Ruta legada /kds → pantalla de instalaciones. */
export function KDSPage() {
  return <Navigate to="/kds/instalaciones" replace />;
}