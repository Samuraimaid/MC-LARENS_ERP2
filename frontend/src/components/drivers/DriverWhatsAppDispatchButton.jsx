import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchWhatsAppDispatch, openWhatsAppDispatch } from "@/lib/driverDispatch";

export default function DriverWhatsAppDispatchButton({
  jobId,
  driverId = null,
  label = "Despachar por WhatsApp",
  size = "sm",
  variant = "outline",
  className = "",
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!jobId) {
      toast.error("No hay trabajo asignado para despachar");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchWhatsAppDispatch(jobId, driverId);
      openWhatsAppDispatch(data);
      toast.success("WhatsApp Web abierto con el enlace de la tarea");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "No se pudo preparar el despacho");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={loading || !jobId}
    >
      <MessageCircle className="mr-2 h-4 w-4 text-[#25D366]" />
      {loading ? "Preparando..." : label}
    </Button>
  );
}