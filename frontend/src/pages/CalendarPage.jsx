import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
// kept utility imports locally as needed
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { toast } from "sonner";
import { 
  ChevronLeft, ChevronRight, Plus, RefreshCw, Calendar as CalendarIcon,
  Wrench, Truck, Clock, User, Car, X
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { API_BASE as API } from "@/lib/api";

const EVENT_TYPES = {
  work_order: { label: "Orden de Trabajo", color: "bg-blue-500", icon: Wrench },
  delivery: { label: "Entrega", color: "bg-green-500", icon: Truck },
  appointment: { label: "Cita", color: "bg-purple-500", icon: Clock },
};

const EVENT_STATUSES = {
  scheduled: "bg-blue-100 border-blue-500 text-blue-800",
  in_progress: "bg-yellow-100 border-yellow-500 text-yellow-800",
  completed: "bg-green-100 border-green-500 text-green-800",
  cancelled: "bg-red-100 border-red-500 text-red-800",
};

export function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  // removed unused viewMode state (not used elsewhere)

  // New event form
  const [newEvent, setNewEvent] = useState({
    title: "",
    event_type: "appointment",
    start_date: new Date(),
    start_time: "09:00",
    end_time: "10:00",
    branch_id: "",
    technician_id: "",
    customer_name: "",
    vehicle_info: "",
    notes: ""
  });

  // Memoize week calculations to prevent infinite loops
  const weekStart = React.useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = React.useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(weekEnd, "yyyy-MM-dd");
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (selectedBranch !== "all") params.append("branch_id", selectedBranch);
      if (selectedTechnician !== "all") params.append("technician_id", selectedTechnician);

      const [eventsRes, techRes, branchRes] = await Promise.all([
        axios.get(`${API}/calendar?${params}`, { withCredentials: true }),
        axios.get(`${API}/users?role=instalaciones`, { withCredentials: true }),
        axios.get(`${API}/branches`, { withCredentials: true }),
      ]);
      
      setEvents(eventsRes.data);
      setTechnicians(techRes.data);
      setBranches(branchRes.data);
    } catch (error) {
      toast.error("Error al cargar calendario");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, selectedBranch, selectedTechnician]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const syncWorkOrders = async () => {
    try {
      const res = await axios.post(`${API}/calendar/sync-work-orders`, {}, { withCredentials: true });
      toast.success(res.data.message);
      fetchEvents();
    } catch (error) {
      toast.error("Error al sincronizar órdenes");
    }
  };

  const createEvent = async () => {
    if (!newEvent.title) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const startDateTime = new Date(newEvent.start_date);
      const [startHour, startMin] = newEvent.start_time.split(":").map(Number);
      startDateTime.setHours(startHour, startMin, 0);

      const endDateTime = new Date(newEvent.start_date);
      const [endHour, endMin] = newEvent.end_time.split(":").map(Number);
      endDateTime.setHours(endHour, endMin, 0);

      const technician = technicians.find(t => t.user_id === newEvent.technician_id);

      await axios.post(`${API}/calendar`, {
        title: newEvent.title,
        event_type: newEvent.event_type,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        branch_id: newEvent.branch_id || null,
        technician_id: newEvent.technician_id || null,
        technician_name: technician?.name || null,
        customer_name: newEvent.customer_name || null,
        vehicle_info: newEvent.vehicle_info || null,
        notes: newEvent.notes || null
      }, { withCredentials: true });

      toast.success("Evento creado");
      setShowNewEvent(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear evento");
    }
  };

  const updateEventStatus = async (eventId, status) => {
    try {
      await axios.put(`${API}/calendar/${eventId}`, { status }, { withCredentials: true });
      toast.success("Evento actualizado");
      fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      toast.error("Error al actualizar evento");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    try {
      await axios.delete(`${API}/calendar/${eventId}`, { withCredentials: true });
      toast.success("Evento eliminado");
      fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      toast.error("Error al eliminar evento");
    }
  };

  const resetForm = () => {
    setNewEvent({
      title: "",
      event_type: "appointment",
      start_date: new Date(),
      start_time: "09:00",
      end_time: "10:00",
      branch_id: "",
      technician_id: "",
      customer_name: "",
      vehicle_info: "",
      notes: ""
    });
  };

  const getEventsForDayAndHour = (day, hour) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start_time);
      return isSameDay(eventStart, day) && eventStart.getHours() === hour;
    });
  };

  const getEventDuration = (event) => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    return Math.ceil((end - start) / (1000 * 60 * 60)); // hours
  };

  return (
    <div className="p-6 space-y-6" data-testid="calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Calendario</h1>
          <p className="text-muted-foreground">Programación de instalaciones y citas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncWorkOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar OT
          </Button>
          <Dialog open={showNewEvent} onOpenChange={(open) => { setShowNewEvent(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-event-btn">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Evento</DialogTitle>
                <DialogDescription>Programa una cita o instalación</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Título del evento"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={newEvent.event_type} onValueChange={(v) => setNewEvent({ ...newEvent, event_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPES).map(([key, type]) => (
                          <SelectItem key={key} value={key}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(newEvent.start_date, "PPP", { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newEvent.start_date}
                          onSelect={(date) => date && setNewEvent({ ...newEvent, start_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hora Inicio</Label>
                    <Input
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Hora Fin</Label>
                    <Input
                      type="time"
                      value={newEvent.end_time}
                      onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sucursal</Label>
                    <Select value={newEvent.branch_id} onValueChange={(v) => setNewEvent({ ...newEvent, branch_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.branch_id} value={b.branch_id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Técnico</Label>
                    <Select value={newEvent.technician_id} onValueChange={(v) => setNewEvent({ ...newEvent, technician_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map(t => (
                          <SelectItem key={t.user_id} value={t.user_id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input
                    value={newEvent.customer_name}
                    onChange={(e) => setNewEvent({ ...newEvent, customer_name: e.target.value })}
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label>Vehículo</Label>
                  <Input
                    value={newEvent.vehicle_info}
                    onChange={(e) => setNewEvent({ ...newEvent, vehicle_info: e.target.value })}
                    placeholder="Ej: Toyota Hilux 2023 - ABC123"
                  />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <Button onClick={createEvent} className="w-full">
                  Crear Evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters & Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setCurrentWeek(new Date())}>
                  Hoy
                </Button>
              </div>
              <span className="font-medium">
                {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.branch_id} value={b.branch_id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {technicians.map(t => (
                    <SelectItem key={t.user_id} value={t.user_id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header with days */}
                <div className="grid grid-cols-8 border-b">
                  <div className="p-2 text-center text-sm font-medium text-muted-foreground border-r">
                    Hora
                  </div>
                  {weekDays.map((day, idx) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div 
                        key={idx} 
                        className={`p-2 text-center border-r last:border-r-0 ${isToday ? 'bg-primary/10' : ''}`}
                      >
                        <div className="text-xs text-muted-foreground">
                          {format(day, "EEE", { locale: es })}
                        </div>
                        <div className={`text-lg font-medium ${isToday ? 'text-primary' : ''}`}>
                          {format(day, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time slots */}
                {hours.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b min-h-[80px]">
                    <div className="p-2 text-xs text-muted-foreground border-r flex items-start justify-center">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const dayEvents = getEventsForDayAndHour(day, hour);
                      return (
                        <div 
                          key={dayIdx} 
                          className="border-r last:border-r-0 p-1 relative"
                        >
                          {dayEvents.map(event => {
                            const eventType = EVENT_TYPES[event.event_type] || EVENT_TYPES.appointment;
                            const EventIcon = eventType.icon;
                            const duration = getEventDuration(event);
                            
                            return (
                              <div
                                key={event.event_id}
                                className={`${EVENT_STATUSES[event.status] || EVENT_STATUSES.scheduled} border-l-4 rounded p-1 mb-1 cursor-pointer hover:opacity-80 transition`}
                                style={{ minHeight: `${Math.max(duration * 40, 40)}px` }}
                                onClick={() => setSelectedEvent(event)}
                              >
                                <div className="flex items-center gap-1 text-xs font-medium">
                                  <EventIcon className="h-3 w-3" />
                                  <span className="truncate">{event.title}</span>
                                </div>
                                {event.customer_name && (
                                  <div className="text-xs truncate mt-0.5 opacity-80">
                                    {event.customer_name}
                                  </div>
                                )}
                                {event.technician_name && (
                                  <div className="text-xs truncate opacity-70 flex items-center gap-1">
                                    <User className="h-2 w-2" />
                                    {event.technician_name}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        {Object.entries(EVENT_TYPES).map(([key, type]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${type.color}`}></div>
            <span>{type.label}</span>
          </div>
        ))}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && EVENT_TYPES[selectedEvent.event_type] && (
                <>
                  {React.createElement(EVENT_TYPES[selectedEvent.event_type].icon, { className: "h-5 w-5" })}
                  {selectedEvent.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <p>{format(parseISO(selectedEvent.start_time), "PPP", { locale: es })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Hora:</span>
                  <p>
                    {format(parseISO(selectedEvent.start_time), "HH:mm")} - {format(parseISO(selectedEvent.end_time), "HH:mm")}
                  </p>
                </div>
                {selectedEvent.technician_name && (
                  <div>
                    <span className="text-muted-foreground">Técnico:</span>
                    <p className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedEvent.technician_name}
                    </p>
                  </div>
                )}
                {selectedEvent.customer_name && (
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p>{selectedEvent.customer_name}</p>
                  </div>
                )}
                {selectedEvent.vehicle_info && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Vehículo:</span>
                    <p className="flex items-center gap-1">
                      <Car className="h-4 w-4" />
                      {selectedEvent.vehicle_info}
                    </p>
                  </div>
                )}
              </div>
              
              {selectedEvent.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">Notas:</span>
                  <p className="text-sm mt-1">{selectedEvent.notes}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Select 
                  value={selectedEvent.status} 
                  onValueChange={(status) => updateEventStatus(selectedEvent.event_id, status)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="destructive" size="icon" onClick={() => deleteEvent(selectedEvent.event_id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
