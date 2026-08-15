"""Seller-first tutorial curriculum served by /api/tutorials.

Content is structured for progressive learning: zero -> first sale -> edge cases.
Images live under /tutorials/* (frontend public assets).
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

TUTORIALS_VERSION = "2026.08.seller-v1"

SELLER_MODULES: List[Dict[str, Any]] = [
    {
        "id": "01-login-pin",
        "order": 1,
        "level": "basico",
        "duration_min": 4,
        "title": "Iniciar sesion con PIN",
        "summary": "Como entrar al ERP de forma segura y que hacer si fallas el PIN.",
        "image": "/tutorials/01-login-pin.jpg",
        "image_alt": "Pantalla de login con teclado PIN y contador de intentos",
        "objectives": [
            "Ingresar con tu PIN de 8 digitos de login",
            "Reconocer el bloqueo por intentos fallidos",
            "Nunca compartir tu PIN",
        ],
        "steps": [
            {
                "title": "Abre el ERP en el navegador",
                "detail": "Usa la URL de tu sucursal (HTTP puerto 3000 en PC o HTTPS 3443 si usas camara del celular/tablet).",
            },
            {
                "title": "Ingresa tu PIN de login (8 digitos)",
                "detail": "Es el PIN de inicio de sesion, no el de marcacion de 4 digitos de RRHH.",
            },
            {
                "title": "Pulsa Entrar / confirmalo",
                "detail": "Si el PIN es correcto se crea una sesion con cookie segura y entras a tu menu de rol.",
            },
            {
                "title": "Si te equivocas",
                "detail": "El sistema muestra intentos restantes. Tras varios fallos hay bloqueo temporal con contador en pantalla roja. Espera o pide a gerencia/RRHH desbloqueo.",
            },
        ],
        "dos": [
            "Cierra sesion al terminar el turno",
            "Bloquea la terminal si te alejas (candado de sesion)",
        ],
        "donts": [
            "No compartas tu PIN con otro vendedor",
            "No uses el PIN de otra persona para 'acelerar'",
        ],
        "scenarios": [
            {
                "name": "PIN bloqueado",
                "procedure": "No sigas intentando. Espera el tiempo de lockout o avisa a gerencia. Forzar reintentos alarga el bloqueo.",
            },
            {
                "name": "Sesion caducada",
                "procedure": "Vuelve a login con tu PIN. Los borradores de venta se conservan en tu usuario si no los borraste.",
            },
        ],
        "related_routes": ["/login"],
    },
    {
        "id": "02-mapa-menu",
        "order": 2,
        "level": "basico",
        "duration_min": 5,
        "title": "Mapa del menu del vendedor",
        "summary": "Que pantallas usas a diario y cuales no te corresponden.",
        "image": "/tutorials/02-menu-vendedor.jpg",
        "image_alt": "Barra lateral del ERP resaltando modulos de ventas",
        "objectives": [
            "Ubicar Ventas, Cotizaciones, Clientes, Vehiculos, Creditos y Devoluciones",
            "Saber que Caja, Despacho y QC no son de tu rol",
        ],
        "steps": [
            {
                "title": "Centro Unificado / Ventas",
                "detail": "Tu base de trabajo: borradores, carrito, envio a caja.",
            },
            {
                "title": "Clientes y Vehiculos",
                "detail": "Alta y busqueda de clientes; registro de placas y datos del vehiculo antes de vender con instalacion.",
            },
            {
                "title": "Cotizaciones",
                "detail": "Ofertas con vigencia; luego se convierten a venta si el cliente acepta.",
            },
            {
                "title": "Tutoriales (esta guia)",
                "detail": "Siempre disponible en el menu para repasar procedimientos.",
            },
        ],
        "dos": ["Usa solo modulos con permiso; si ves 403 es normal"],
        "donts": [
            "No intentes entrar a Caja, Despacho o listado de PIN de personal",
            "No uses gerencia de otro usuario",
        ],
        "scenarios": [
            {
                "name": "Menu vacio o incompleto",
                "procedure": "Cierra sesion y vuelve a entrar. Si persiste, tu rol no tiene el modulo o la sucursal lo deshabilito (node profile).",
            }
        ],
        "related_routes": ["/sales", "/customers", "/vehicles", "/quotations", "/help/tutorials"],
    },
    {
        "id": "03-cliente-vehiculo",
        "order": 3,
        "level": "basico",
        "duration_min": 8,
        "title": "Cliente y vehiculo (obligatorios bien hechos)",
        "summary": "Sin cliente/vehiculo correctos la instalacion y la entrega fallan despues.",
        "image": "/tutorials/03-cliente-vehiculo.jpg",
        "image_alt": "Formulario de cliente y selector de vehiculo con placa",
        "objectives": [
            "Buscar o crear cliente natural/empresa",
            "Asociar o registrar vehiculo con placa valida",
            "Validar telefono y datos de credito si aplica",
        ],
        "steps": [
            {
                "title": "Busca al cliente (Alt+C en venta)",
                "detail": "Por nombre, telefono o cedula/RUC. Evita duplicados: confirma si ya existe.",
            },
            {
                "title": "Si es nuevo, registralo completo",
                "detail": "Nombre, telefono formato 0000-0000, tipo natural/empresa. Empresas pueden llevar retencion IR.",
            },
            {
                "title": "Selecciona o crea el vehiculo",
                "detail": "Marca, modelo, anio, color y placa. La placa correcta evita confusiones en taller y polarizados.",
            },
            {
                "title": "Credito (solo si el cliente ya tiene limite)",
                "detail": "Si no tiene limite aprobado, no elijas pago a credito: gerencia debe configurar el perfil primero.",
            },
        ],
        "dos": [
            "Verifica el telefono con el cliente en voz alta",
            "Confirma que el vehiculo es el que esta en el patio",
        ],
        "donts": [
            "No inventes placas",
            "No uses un cliente generico para 'terminar mas rapido'",
        ],
        "scenarios": [
            {
                "name": "Cliente empresa con retencion",
                "procedure": "Marca tipo empresa. En venta activa retencion si aplica (1%/2%) y el sistema puede forzar factura carta.",
            },
            {
                "name": "Cliente sin vehiculo aun",
                "procedure": "Puedes cotizar, pero para instalacion/polarizado registra el vehiculo antes de enviar a caja.",
            },
        ],
        "related_routes": ["/customers", "/vehicles", "/sales"],
    },
    {
        "id": "04-borrador-venta",
        "order": 4,
        "level": "basico",
        "duration_min": 10,
        "title": "Borrador de venta desde cero",
        "summary": "El borrador es tu espacio de trabajo seguro: guarda solo, no cobra.",
        "image": "/tutorials/04-borrador-venta.jpg",
        "image_alt": "Pestanas de borradores y carrito de venta",
        "objectives": [
            "Crear y nombrar borradores",
            "Usar autoguardado y Ctrl+S",
            "Manejar varios borradores en paralelo",
        ],
        "steps": [
            {
                "title": "Abre Ventas / Nueva venta",
                "detail": "Se crea o reanuda un borrador. Puedes tener varias pestanas (varios clientes).",
            },
            {
                "title": "Selecciona cliente y vehiculo",
                "detail": "Usa Alt+C para clientes. Confirma datos en el encabezado del borrador.",
            },
            {
                "title": "Agrega productos (Alt+P)",
                "detail": "Busca por nombre o SKU. Enter agrega la linea. Ajusta cantidad e instalacion por linea.",
            },
            {
                "title": "Guarda con Ctrl+S si pausas",
                "detail": "Hay autoguardado, pero Ctrl+S da certeza al cambiar de conversacion.",
            },
        ],
        "dos": ["Un borrador por cliente activo", "Nombra el borrador con apellido del cliente"],
        "donts": [
            "No mezcles dos clientes en el mismo borrador",
            "No borres un borrador en revision de supervision",
        ],
        "scenarios": [
            {
                "name": "Se fue la luz / se cerro el navegador",
                "procedure": "Vuelve a entrar: el borrador reaparece en tus pestanas. Revisa carrito y totales antes de continuar.",
            },
            {
                "name": "Borrador en revision por supervision",
                "procedure": "No liberes tu el borrador. Espera watch/release de supervisor/gerencia. Algunas lineas quedan bloqueadas.",
            },
        ],
        "related_routes": ["/sales"],
        "shortcuts": [
            {"keys": "Alt + C", "action": "Buscar cliente"},
            {"keys": "Alt + P", "action": "Buscar producto"},
            {"keys": "Ctrl + S", "action": "Guardar borrador"},
        ],
    },
    {
        "id": "05-productos-instalacion",
        "order": 5,
        "level": "intermedio",
        "duration_min": 12,
        "title": "Productos, stock e instalacion",
        "summary": "Como armar el carrito sin sobreventa y con instalacion correcta por departamento.",
        "image": "/tutorials/05-productos-instalacion.jpg",
        "image_alt": "Busqueda de productos con switch de instalacion",
        "objectives": [
            "Buscar y agregar productos con stock",
            "Marcar con instalacion cuando aplica",
            "Entender que polarizado/electrico/instalaciones se separan en taller",
        ],
        "steps": [
            {
                "title": "Busca por nombre o SKU",
                "detail": "Filtra en el catalogo. Si no hay stock suficiente el sistema rechazara la venta al facturar.",
            },
            {
                "title": "Activa 'con instalacion' cuando el cliente lo pide o el producto lo exige",
                "detail": "Productos de polarizado suelen requerir instalacion. Accesorios electronicos van a departamento electrico.",
            },
            {
                "title": "Revisa precio de instalacion en la linea",
                "detail": "Se suma al subtotal. El catalogo esta en USD; la liquidacion se muestra en C$ con tipo de cambio.",
            },
            {
                "title": "No fuerces cantidades enormes",
                "detail": "Cantidad <= 0 o stock insuficiente = error. Ajusta a lo disponible o pide reposicion a bodega.",
            },
        ],
        "dos": [
            "Confirma compatibilidad con el vehiculo del cliente",
            "Separa en la nota si algo es 'solo para llevar'",
        ],
        "donts": [
            "No prometas stock que no ves en el sistema",
            "No desactives instalacion en polarizado si el trabajo se hara en taller",
        ],
        "scenarios": [
            {
                "name": "Producto solo para llevar + cliente pide instalacion",
                "procedure": "Requiere autorizacion de gerencia (codigo manager). No improvises: solicita el codigo o cambia el producto.",
            },
            {
                "name": "Venta mixta (accesorio + radio + polarizado)",
                "procedure": "Es valido. Tras el cobro se crean OT por departamento (instalaciones, electrico, polarizados) y despacho de fisicos.",
            },
        ],
        "related_routes": ["/sales", "/catalog"],
    },
    {
        "id": "06-precios-y-tiers",
        "order": 6,
        "level": "intermedio",
        "duration_min": 12,
        "title": "Precios: Precio 1, Precio 2 y politicas",
        "summary": "Reglas de tarifa para vendedores de piso vs VIP y cuando pedir aprobacion.",
        "image": "/tutorials/06-precios-tiers.jpg",
        "image_alt": "Selector de niveles de precio y aviso de aprobacion Precio 2",
        "objectives": [
            "Usar Precio 1 como tarifa base de piso",
            "Solicitar y esperar aprobacion de Precio 2",
            "No inventar precios negativos o cero",
        ],
        "steps": [
            {
                "title": "Trabaja en Precio 1 por defecto",
                "detail": "Es la tarifa estandar del vendedor de piso.",
            },
            {
                "title": "Si aplicas Precio 2 en lineas",
                "detail": "Debes solicitar aprobacion a supervision/gerencia con motivo. Sin aprobacion no puedes enviar a caja.",
            },
            {
                "title": "Espera el estado 'aprobado'",
                "detail": "El indicador de Precio 2 debe pasar de pendiente a listo. No reenvies a caja en pendiente.",
            },
            {
                "title": "Cambios de precio por linea",
                "detail": "Bajar demasiado o subir sobre Precio 1 sin permiso puede ser bloqueado por el servidor.",
            },
        ],
        "dos": [
            "Documenta el motivo de Precio 2 (campana, cliente frecuente, etc.)",
            "Verifica el total en C$ antes de hablar del precio final al cliente",
        ],
        "donts": [
            "No pongas unit_price <= 0",
            "No uses Precio 2 'por costumbre' sin aprobacion",
        ],
        "scenarios": [
            {
                "name": "Cliente pide descuento fuerte",
                "procedure": "Usa descuento global dentro del tope de vendedor o pide a supervision que entre al borrador (watch), ajuste y libere.",
            },
            {
                "name": "Vendedor VIP",
                "procedure": "Politica distinta: no modifica precios por linea libremente; usa la tarifa establecida. Si no eres VIP, no copies su practica.",
            },
        ],
        "related_routes": ["/sales", "/approvals"],
    },
    {
        "id": "07-descuentos-supervision",
        "order": 7,
        "level": "intermedio",
        "duration_min": 10,
        "title": "Descuentos y revision de supervision",
        "summary": "Tope de descuento del vendedor y flujo watch -> ajuste -> release.",
        "image": "/tutorials/07-descuentos-supervision.jpg",
        "image_alt": "Borrador en revision por supervision con descuento global",
        "objectives": [
            "Respetar el tope de descuento global del vendedor",
            "Entender que puede y no puede editar tras la liberacion",
            "Comunicar al cliente solo totales ya autorizados",
        ],
        "steps": [
            {
                "title": "Descuento global de vendedor",
                "detail": "Hay un maximo % y/o monto en C$. Si lo excedes, el servidor responde error de politica.",
            },
            {
                "title": "Cuando supervision toma el borrador (watch)",
                "detail": "Pueden aplicar descuento de linea o global. Tu veras notificaciones de cambio/liberacion.",
            },
            {
                "title": "Tras release con cambios",
                "detail": "Algunos campos quedan bloqueados (pago, retencion, descuentos). Puedes agregar productos permitidos y enviar a caja.",
            },
            {
                "title": "Confirma el total final en pantalla",
                "detail": "Subtotal, descuento, IVA y neto a cobrar deben cuadrar con lo dicho al cliente.",
            },
        ],
        "dos": ["Pide supervision por el canal interno antes de prometer descuentos grandes"],
        "donts": [
            "No intentes liberar tu propio borrador (sale bloqueado)",
            "No edites a escondidas un borrador ya liberado con cambios de supervision",
        ],
        "scenarios": [
            {
                "name": "Descuento en pago con tarjeta",
                "procedure": "Tarjeta puede anular descuentos por politica. El sistema avisa. Coordina con caja/gerencia; no pelees el total en piso.",
            }
        ],
        "related_routes": ["/sales"],
    },
    {
        "id": "08-entrega-y-paso2",
        "order": 8,
        "level": "intermedio",
        "duration_min": 8,
        "title": "Entrega, retiro en tienda y Paso 2",
        "summary": "Configura bien el modo de entrega para no romper logistica.",
        "image": "/tutorials/08-entrega-paso2.jpg",
        "image_alt": "Selector de modo de entrega y datos de mensajeria",
        "objectives": [
            "Elegir retiro en tienda vs delivery",
            "Completar datos de delivery cuando aplica",
            "No dejar el Paso 2 vacio",
        ],
        "steps": [
            {
                "title": "Define si es para llevar / taller / delivery",
                "detail": "El flujo de entrega aparece segun el caso. Si ocultas el selector, igual debes tener un modo valido.",
            },
            {
                "title": "Delivery: direccion y mensajero si el sistema lo pide",
                "detail": "Datos incompletos = error al validar. Completa antes de enviar a caja.",
            },
            {
                "title": "Instalacion en sucursal",
                "detail": "El cliente deja el vehiculo: confirma que la OT saldra tras el cobro en caja.",
            },
        ],
        "dos": ["Lee en voz alta la direccion de delivery al cliente"],
        "donts": ["No marques delivery 'por si acaso' sin direccion"],
        "scenarios": [
            {
                "name": "Paso 2 no se ve",
                "procedure": "Vuelve a elegir el modo de flujo de vehiculo/entrega. Si el picker esta oculto, el modo guardado debe ser valido; reinicia el paso desde el encabezado del borrador.",
            }
        ],
        "related_routes": ["/sales", "/deliveries"],
    },
    {
        "id": "09-pago-y-envio-caja",
        "order": 9,
        "level": "intermedio",
        "duration_min": 12,
        "title": "Forma de pago y envio a caja",
        "summary": "El vendedor no cobra: prepara el plan y manda la factura a caja.",
        "image": "/tutorials/09-envio-caja.jpg",
        "image_alt": "Dialogo de confirmacion enviar a caja y resumen de totales",
        "objectives": [
            "Elegir efectivo, tarjeta, transferencia, credito o mixto",
            "Confirmar el dialogo de envio a caja",
            "Entender que el cobro lo hace el cajero",
        ],
        "steps": [
            {
                "title": "Elige metodo de pago",
                "detail": "Cash, card, transfer, credit o mixed. Credito exige limite y dias del cliente.",
            },
            {
                "title": "Revisa neto a cobrar en C$",
                "detail": "El servidor calcula IVA, descuentos y tipo de cambio. El plan de pago debe cuadrar (el sistema puede auto-ajustar centavos).",
            },
            {
                "title": "Confirma 'Enviar a caja'",
                "detail": "Aparece un dialogo de confirmacion (no es el voucher termico). Confirma solo si el cliente esta de acuerdo con el total.",
            },
            {
                "title": "Entrega el numero de factura al cajero/cliente",
                "detail": "El cajero cobra en su modulo. Tras el pago se disparan despacho y OT de taller automaticamente.",
            },
        ],
        "dos": [
            "Usa el dialogo de confirmacion como checklist final",
            "Acompana al cliente a caja si es su primera visita",
        ],
        "donts": [
            "No digas 'ya esta pagado' hasta que caja confirme",
            "No intentes cobrar en efectivo por fuera del sistema",
        ],
        "scenarios": [
            {
                "name": "Error TOTAL_MISMATCH o PAYMENT_PLAN_MISMATCH",
                "procedure": "No pelees con el total a mano. Recarga totales / reenvia: el servidor manda. Si persiste, pide a supervision revisar el borrador.",
            },
            {
                "name": "Pago mixto",
                "procedure": "Define las lineas del plan (ej. parte efectivo + transferencia) que sumen el neto. Caja cobrara segun el plan.",
            },
            {
                "name": "Factura ya pagada: editar?",
                "procedure": "No se puede solicitar edicion de factura pagada. Anulacion o ajuste solo con gerencia y justificacion.",
            },
        ],
        "related_routes": ["/sales", "/cashier"],
    },
    {
        "id": "10-cotizaciones",
        "order": 10,
        "level": "intermedio",
        "duration_min": 8,
        "title": "Cotizaciones: crear, PDF y convertir",
        "summary": "Cuando el cliente aun no decide comprar.",
        "image": "/tutorials/10-cotizaciones.jpg",
        "image_alt": "Pantalla de cotizacion con vigencia y boton convertir a venta",
        "objectives": [
            "Crear cotizacion con vigencia",
            "Compartir/imprimir PDF",
            "Convertir a venta solo si esta aprobada y vigente",
        ],
        "steps": [
            {
                "title": "Nueva cotizacion",
                "detail": "Cliente, vehiculo, productos, moneda y dias de validez.",
            },
            {
                "title": "Revisa PDF con el cliente",
                "detail": "Ajusta precios/descuentos antes de que se venza.",
            },
            {
                "title": "Convierte a venta",
                "detail": "Solo cotizaciones aprobadas y no vencidas. Luego el flujo sigue como venta normal a caja.",
            },
        ],
        "dos": ["Anota la fecha de validez en la conversacion con el cliente"],
        "donts": ["No conviertas cotizaciones vencidas 'a la fuerza'"],
        "scenarios": [
            {
                "name": "Cotizacion vencida",
                "procedure": "Crea una nueva o pide a supervision renovar politica; no uses la vieja.",
            }
        ],
        "related_routes": ["/quotations", "/sales"],
    },
    {
        "id": "11-creditos-devoluciones",
        "order": 11,
        "level": "avanzado",
        "duration_min": 8,
        "title": "Creditos y devoluciones (lo que si te toca)",
        "summary": "Consulta y solicita; no forces anulaciones de facturas pagadas.",
        "image": "/tutorials/11-creditos-devoluciones.jpg",
        "image_alt": "Listado de creditos y formulario de devolucion",
        "objectives": [
            "Ver estado de credito del cliente",
            "Iniciar devolucion segun politica",
            "Escalar anulaciones a supervision",
        ],
        "steps": [
            {
                "title": "Modulo Creditos",
                "detail": "Consulta saldos y ventas a credito del cliente. No aumentes limites: eso es gerencia.",
            },
            {
                "title": "Devoluciones",
                "detail": "Sigue el formulario con factura y motivo. Productos instalados tienen reglas distintas.",
            },
            {
                "title": "Anulacion de factura",
                "detail": "Solicitud con razon de al menos 10 caracteres. Facturas pagadas no se anulan por el flujo simple de vendedor.",
            },
        ],
        "dos": ["Documenta evidencia (foto, nota) en devoluciones"],
        "donts": ["No prometas reembolso en efectivo sin caja/gerencia"],
        "scenarios": [
            {
                "name": "Cliente quiere anular ya cobrado",
                "procedure": "Explica el proceso formal. Abre solicitud o llama a gerencia. No borres registros.",
            }
        ],
        "related_routes": ["/credits", "/returns", "/sales"],
    },
    {
        "id": "12-despues-del-cobro",
        "order": 12,
        "level": "avanzado",
        "duration_min": 6,
        "title": "Que pasa despues del cobro (para explicar al cliente)",
        "summary": "No operas taller, pero debes orientar al cliente con el flujo real.",
        "image": "/tutorials/12-post-cobro.jpg",
        "image_alt": "Diagrama venta pagada -> despacho -> OT -> QC -> entrega",
        "objectives": [
            "Explicar despacho de bodega",
            "Explicar OT de instalaciones / electrico / polarizados",
            "Explicar control de calidad antes de entrega",
        ],
        "steps": [
            {
                "title": "Caja cobra y se dispara el fulfillment",
                "detail": "Se crea despacho de productos fisicos y ordenes de trabajo por departamento si hay instalacion.",
            },
            {
                "title": "Bodega surte el material",
                "detail": "El despachador entrega items. Sin esto el taller puede esperar material.",
            },
            {
                "title": "Taller trabaja y pasa por QC",
                "detail": "Instalador/electrico/polarizador marcan avance; coordinacion aprueba calidad; luego se entrega el vehiculo.",
            },
        ],
        "dos": ["Da tiempos realistas: no inventes 'en 20 minutos' sin consultar taller"],
        "donts": ["No digas que 'ya esta listo' solo porque se pago"],
        "scenarios": [
            {
                "name": "Cliente pregunta por polarizado",
                "procedure": "Hay OT de polarizados + detalle de ventanas. Coordinacion de polarizados asigna tecnico.",
            }
        ],
        "related_routes": ["/sales"],
    },
    {
        "id": "13-errores-comunes",
        "order": 13,
        "level": "avanzado",
        "duration_min": 10,
        "title": "Errores comunes y como resolverlos",
        "summary": "Tabla de sintomas -> causa -> procedimiento correcto.",
        "image": "/tutorials/13-errores-comunes.jpg",
        "image_alt": "Lista de mensajes de error frecuentes del ERP",
        "objectives": [
            "Identificar mensajes del servidor",
            "Aplicar el fix correcto sin saltarse politicas",
        ],
        "steps": [
            {
                "title": "Lee el mensaje completo del toast/dialogo",
                "detail": "Suele traer la causa exacta (stock, credito, precio, plan de pago).",
            },
            {
                "title": "Corrige en el borrador, no en un papel aparte",
                "detail": "Todo debe quedar en el sistema para caja y taller.",
            },
            {
                "title": "Si es politica (Precio 2, descuento, credito), escala",
                "detail": "Supervision/gerencia. No busques atajos de PIN ajenos.",
            },
        ],
        "dos": ["Captura o anota el codigo de error si vas a pedir soporte"],
        "donts": ["No reinicies el PC como primer recurso"],
        "scenarios": [
            {
                "name": "Insufficient inventory",
                "procedure": "Baja cantidad o cambia bodega/producto. Pide stock a bodega.",
            },
            {
                "name": "Precio 2 requiere aprobacion",
                "procedure": "Envia solicitud con motivo y espera aprobacion antes de caja.",
            },
            {
                "name": "Exceeds credit limit",
                "procedure": "Cambia a contado o pide a gerencia ampliar limite del cliente.",
            },
            {
                "name": "403 en un modulo",
                "procedure": "Tu rol no tiene permiso. Es correcto; no es un bug de red.",
            },
            {
                "name": "Toasts duplicados al recargar",
                "procedure": "Ignora duplicados de estado ya visto; si es persistente reporta a programador con hora exacta.",
            },
        ],
        "related_routes": ["/sales", "/help/tutorials"],
    },
    {
        "id": "14-atajos-checklist",
        "order": 14,
        "level": "basico",
        "duration_min": 5,
        "title": "Atajos y checklist de cierre de venta",
        "summary": "Memoriza atajos y el checklist final antes de caja.",
        "image": "/tutorials/14-atajos-checklist.jpg",
        "image_alt": "Checklist visual de cierre de venta",
        "objectives": [
            "Usar atajos de teclado",
            "Pasar el checklist de 8 puntos antes de enviar a caja",
        ],
        "steps": [
            {
                "title": "Atajos principales",
                "detail": "Alt+C cliente · Alt+P producto · Ctrl+S guardar · Enter seleccionar · Esc cerrar busqueda · Tab siguiente campo.",
            },
            {
                "title": "Checklist final",
                "detail": "1) Cliente correcto 2) Vehiculo/placa 3) Productos y qty 4) Instalacion marcada 5) Precio/tier OK 6) Descuentos autorizados 7) Metodo de pago 8) Total en C$ acordado.",
            },
            {
                "title": "Envia a caja y acompana",
                "detail": "Confirma el dialogo y da el numero de factura.",
            },
        ],
        "dos": ["Imprime mentalmente el checklist en cada venta grande"],
        "donts": ["No saltes el dialogo de confirmacion sin leer el total"],
        "scenarios": [],
        "related_routes": ["/sales"],
        "shortcuts": [
            {"keys": "Alt + C", "action": "Buscar cliente"},
            {"keys": "Alt + P", "action": "Buscar producto"},
            {"keys": "Ctrl + S", "action": "Guardar borrador"},
            {"keys": "Up / Down", "action": "Mover seleccion en listas"},
            {"keys": "Enter", "action": "Seleccionar / agregar"},
            {"keys": "Esc", "action": "Cerrar busqueda"},
            {"keys": "Tab", "action": "Siguiente campo"},
            {"keys": "Shift + Tab", "action": "Campo anterior"},
        ],
    },
]


def _all_modules() -> List[Dict[str, Any]]:
    return deepcopy(SELLER_MODULES)


def get_tutorials_catalog(
    *,
    audience: Optional[str] = None,
    level: Optional[str] = None,
) -> Dict[str, Any]:
    modules = _all_modules()
    if level:
        level_key = str(level).strip().lower()
        modules = [m for m in modules if str(m.get("level") or "") == level_key]

    _ = audience

    return {
        "version": TUTORIALS_VERSION,
        "title": "Academia del Vendedor - ERP Mundo de Accesorios",
        "subtitle": (
            "Aprende el sistema desde cero: del login al envio a caja "
            "y que pasa despues del cobro."
        ),
        "audience_default": "ventas",
        "locale": "es-NI",
        "total_modules": len(modules),
        "estimated_minutes": sum(int(m.get("duration_min") or 0) for m in modules),
        "levels": ["basico", "intermedio", "avanzado"],
        "modules": [
            {
                "id": m["id"],
                "order": m["order"],
                "level": m["level"],
                "duration_min": m["duration_min"],
                "title": m["title"],
                "summary": m["summary"],
                "image": m.get("image"),
                "image_alt": m.get("image_alt"),
            }
            for m in sorted(modules, key=lambda x: int(x.get("order") or 0))
        ],
        "golden_rules": [
            "Tu PIN es personal: no se comparte.",
            "El vendedor no cobra: envia a caja con total autorizado.",
            "Precio 2 y descuentos fuera de tope = supervision.",
            "Sin stock / sin credito / sin datos de delivery = no improvises.",
            "Factura pagada no se edita por vendedor.",
            "Despues del cobro: despacho + OT + QC; no digas 'listo' solo por pagar.",
        ],
        "opinion": {
            "headline": "Opinion de arquitectura sobre este endpoint",
            "points": [
                "El valor esta en el contenido versionado y consumible por la UI, no en PDFs sueltos.",
                "Conviene que /tutorials sea la fuente de verdad (como dialog-messages): gerencia/programador podra editar modulos sin redeploy del front.",
                "Las capturas deben vivir en /tutorials/* con nombres estables; el front solo renderiza lo que manda la API.",
                "Proximo paso natural: progreso por usuario (modulo completado), quiz corto y forzar onboarding en el primer login del vendedor.",
                "No mezclar tutoriales de caja/taller en el track de ventas: tracks por rol evitan confusion y permisos cruzados.",
                "Metrica util: % de vendedores que completaron modulos basicos antes de la primera venta del mes.",
            ],
            "risks": [
                "Contenido desactualizado si cambia un flujo y nadie versiona TUTORIALS_VERSION.",
                "Imagenes pesadas: preferir WebP/JPG optimizado < 300KB por modulo.",
                "Si solo es estatico en el front, cada cambio exige rebuild de imagen Docker.",
            ],
            "recommendation": (
                "Mantener API + assets versionados; anadir mas adelante overrides en Mongo "
                "(como dialog_messages) solo para textos, no para logica de negocio. "
                "Ideal: pipeline de capturas reales con Playwright autenticado por rol."
            ),
        },
    }


def get_tutorial_module(module_id: str) -> Optional[Dict[str, Any]]:
    key = str(module_id or "").strip()
    for module in _all_modules():
        if module.get("id") == key:
            return module
    return None


def get_full_curriculum() -> Dict[str, Any]:
    catalog = get_tutorials_catalog()
    catalog["modules_full"] = _all_modules()
    return catalog
