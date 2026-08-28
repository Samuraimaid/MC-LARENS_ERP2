# Nicaragua document rules

## Plate prefixes (ERP list)

M LE CH MY GR CZ MT BO CT RI NS ES MZ JI RS AN AS TM ZC PN EN CD MI OI

Also accept common typed variants with space or hyphen. `M 123456`, `M-123456`.

Normalize to `{ prefix, digits }` then `formatPlateNumber`.

If prefix unknown, do not invent `M`. Leave plate raw and mark `needs_review`.

## VIN / chasis

- Length 17
- Alphabet `A-HJ-NPR-Z0-9`
- Reject I, O, Q
- Common OCR swaps to try only when checksum/length almost matches. `8`↔`B`, `0`↔`D`, `5`↔`S`, `1`↔`I` (I is illegal so prefer `1`)

If after cleanup length != 17, return null.

## Cedula

`XXX-XXXXXX-XXXXA` example `001-010180-0000A`

Do not guess check letter.

## RUC

Starts with `J` for empresas. Do not mix into vehicle plate.

## Circulation card labels to hunt

Spanish labels vary by year/print. Match any of:

- PLACA / MATRICULA / NUMERO DE PLACA
- CHASIS / VIN / NUMERO DE VIN / N. VIN
- MARCA
- MODELO / LINEA
- ANIO / AÑO / MODELO ANIO
- COLOR
- MOTOR / N. MOTOR
- COMBUSTIBLE
- TIPO / CLASE / USO
- PROPIETARIO / CEDULA

## vehicle_type_slug map

| Text on card | slug |
|---|---|
| Automovil, sedan, turismo | sedan |
| Hatchback, compacto | hatchback |
| Camioneta, pickup, pick-up | pickup |
| Jeep, SUV, rural | suv |
| Microbus, van, panel | van |
| Camion, head, furgon | truck |
| Moto, motocicleta | moto |

Default `sedan` only if type unread.

## Catalog match

Use `frontend/src/lib/vehicleCatalog.js` / `vehicleCatalog.json`.

Fuzzy order. exact → casefold → without accents → token overlap.

Examples. `TOYTA` → Toyota. `HILUX D/C` → Hilux + cab variant if pickup helper says so.

Year window. 1980 … currentYear+1.
