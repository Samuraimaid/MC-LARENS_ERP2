$descriptorTypes = Get-Content 'frontend/src/data/vehicleDescriptorTypes.json' -Raw | ConvertFrom-Json
$knownCategories = @(
  'sedan', 'hatchback', 'suv', 'camioneta_doble_cabina', 'camioneta_cabina_media',
  'camioneta_1_cabina', 'camion_1_cabina', 'camion_2_cabinas', 'camion_carga_furgon',
  'station_wagon', 'microbus_pasajeros', 'microbus_techo_alto', 'microbus_carga',
  'bus_mediano_coaster', 'bus_grande_marcopolo', 'moto'
)
$genericSlugs = @('', 'sedan', 'sedan', 'auto', 'automovil', 'turismo', 'default', 'car', 'vehiculo')

$categoryAliases = @{
  'hatchback' = 'hatchback'; 'compacto' = 'hatchback'; 'hb' = 'hatchback'
  'coupe' = 'sedan'; 'convertible' = 'sedan'; 'automovil' = 'sedan'
  'pickup' = 'camioneta_doble_cabina'; 'pick-up' = 'camioneta_doble_cabina'; 'camioneta-doble-cabina' = 'camioneta_doble_cabina'; 'camioneta_doble_cabina' = 'camioneta_doble_cabina'
  'pickup-cabina-media' = 'camioneta_cabina_media'; 'camioneta-cabina-y-media' = 'camioneta_cabina_media'; 'camioneta_cabina_media' = 'camioneta_cabina_media'
  'pickup-1-cabina' = 'camioneta_1_cabina'; 'camioneta-1-cabina' = 'camioneta_1_cabina'; 'camioneta_1_cabina' = 'camioneta_1_cabina'
  'station-wagon' = 'station_wagon'; 'station wagon' = 'station_wagon'; 'st-wagon' = 'station_wagon'; 'suv' = 'suv'; 'crossover' = 'suv'
  'furgon' = 'microbus_carga'; 'panel' = 'microbus_carga'; 'minivan' = 'microbus_pasajeros'; 'van' = 'microbus_pasajeros'
  'camion' = 'camion_1_cabina'; 'truck' = 'camion_1_cabina'; 'cabezal' = 'camion_1_cabina'
  'bus' = 'bus_mediano_coaster'; 'moto' = 'moto'
}

function Resolve-VehicleCategory($vehicle) {
    if (-not $vehicle) { return 'sedan' }
    $rawSlug = ('' + $vehicle.vehicle_type_slug).ToLower().Trim()
    $directSlug = if ($categoryAliases.ContainsKey($rawSlug)) { $categoryAliases[$rawSlug] } elseif ($knownCategories -contains $rawSlug) { $rawSlug } else { '' }
    $isGeneric = (-not $directSlug) -or ($genericSlugs -contains $rawSlug) -or ($directSlug -eq 'sedan')

    if ($directSlug -and -not $isGeneric) {
        return $directSlug
    }

    $brand = ('' + $vehicle.brand).Trim().ToUpper()
    $descriptor = ('' + (if ($vehicle.descriptor) { $vehicle.descriptor } else { $vehicle.model })).Trim()
    
    if ($brand -and $descriptor) {
        $key = $brand + '::' + $descriptor
        $prop = $descriptorTypes.entries.psobject.properties[$key]
        if ($prop) {
            $catSlug = $prop.Value.default_silhouette_slug
            if ($knownCategories -contains $catSlug) { return $catSlug }
            if ($categoryAliases.ContainsKey($catSlug)) { return $categoryAliases[$catSlug] }
        }
    }

    $model = ('' + $vehicle.model).Trim()
    if ($brand -and $model) {
        $modelToken = ($model -split '\(')[0].Trim().ToUpper()
        if ($modelToken.Length -ge 2) {
            $prefix = $brand + '::'
            foreach ($prop in $descriptorTypes.entries.psobject.properties) {
                if ($prop.Name.StartsWith($prefix)) {
                    $entryDesc = $prop.Name.Substring($prefix.Length).ToUpper()
                    if ($entryDesc.Contains($modelToken) -or $entryDesc.StartsWith($modelToken)) {
                        $slug = ('' + $prop.Value.default_silhouette_slug).Trim()
                        if ($knownCategories -contains $slug) { return $slug }
                        if ($categoryAliases.ContainsKey($slug)) { return $categoryAliases[$slug] }
                    }
                }
            }
        }
    }

    $text = ($rawSlug + ' ' + $brand.ToLower() + ' ' + $model.ToLower()).Trim()
    if ($text -match 'marcopolo|bus grande|autobus|pullman') { return 'bus_grande_marcopolo' }
    if ($text -match 'coaster|civilian|rosa|county|cosmos|bus mediano') { return 'bus_mediano_coaster' }
    if ($text -match 'k2700|k2500|porter|h100|dyna|canter|dutro|npr|nqr|nhr|forward|hd72|cabstar|camion') { return 'camion_1_cabina' }
    if ($text -match 'tacoma|hilux|frontier|ranger|d-max|dmax|l200|bt-50|amarok|colorado|silverado|f-150|f150|ram|tundra|titan|navara|poer|wingle|pickup') { return 'camioneta_doble_cabina' }
    if ($text -match 'hiace|urvan|minivan|van|starex|transit|sprinter|sienna|odyssey') { return 'microbus_pasajeros' }
    if ($text -match 'suv|prado|land cruiser|rav4|cr-v|tucson|sportage|santa fe|sorento|patrol|pathfinder|fortuner|4runner|explorer|tracker|tahoe|duster|vitara') { return 'suv' }
    if ($text -match 'hatchback|picanto|spark|march|swift|i10|golf|polo|fit|yaris hb') { return 'hatchback' }

    return 'sedan'
}

function Get-ProductVehicleCompatibility($product, $vehicle) {
    $category = Resolve-VehicleCategory $vehicle
    $sku = ('' + $product.sku).ToUpper()
    $name = ('' + $product.name).ToLower()

    $isPickupVehicle = @('pickup', 'camioneta_doble_cabina', 'camioneta-doble-cabina', 'camioneta_cabina_media', 'camioneta-cabina-y-media', 'camioneta_1_cabina', 'camioneta-1-cabina') -contains $category
    $isSuvVehicle = @('suv', 'station_wagon', 'station-wagon', 'todo_terreno', 'crossover') -contains $category
    $isSedanVehicle = ($category -eq 'sedan') -or (@('coupe', 'convertible') -contains $category)

    $vehicleText = ('' + $vehicle.brand + ' ' + $vehicle.model).ToLower()
    $isPickupByModel = $vehicleText -match 'tacoma|hilux|frontier|ranger|d-max|l200|bt-50|amarok|colorado|silverado|f-150|ram|tundra|titan|pickup'
    $isSuvByModel = $vehicleText -match 'rav4|prado|fortuner|4runner|cr-v|tucson|sportage|explorer|tracker|duster'

    $effectiveIsPickup = $isPickupVehicle -or $isPickupByModel
    $effectiveIsSuv = ($isSuvVehicle -or $isSuvByModel) -and (-not $effectiveIsPickup)
    $effectiveIsSedan = $isSedanVehicle -and (-not $effectiveIsPickup) -and (-not $effectiveIsSuv)

    if ($sku -eq 'POL-DEL-001' -or $name.Contains('vidrios delanteros')) {
        return @{ isCompatible = $true; badge = 'Compatible (Vidrios Delanteros)' }
    }
    if ($sku -eq 'POL-FRA-SUP' -or $name.Contains('franja')) {
        return @{ isCompatible = $true; badge = 'Compatible (Franja Parabrisas)' }
    }

    $isSedanTint = ($sku -eq 'POL-SED-COM') -or ($name.Contains('sedan') -or $name.Contains('sedan'))
    $isSuvTint = ($sku -eq 'POL-SUV-COM') -or $name.Contains('suv')
    $isPickupTint = ($sku -eq 'POL-PCK-COM') -or ($name.Contains('pickup') -or $name.Contains('camioneta pickup'))

    if ($effectiveIsPickup) {
        if ($isPickupTint) { return @{ isCompatible = $true; badge = 'Compatible (Camioneta Pickup)' } }
        return @{ isCompatible = $false; badge = 'Incompatible' }
    } elseif ($effectiveIsSuv) {
        if ($isSuvTint) { return @{ isCompatible = $true; badge = 'Compatible (SUV / Station Wagon)' } }
        return @{ isCompatible = $false; badge = 'Incompatible' }
    } elseif ($effectiveIsSedan) {
        if ($isSedanTint) { return @{ isCompatible = $true; badge = 'Compatible (Sedan / Auto)' } }
        return @{ isCompatible = $false; badge = 'Incompatible' }
    }

    return @{ isCompatible = $true; badge = 'Compatible' }
}

$pckTint = @{ sku = 'POL-PCK-COM'; name = 'Polarizado Completo Camioneta Pickup' }
$sedTint = @{ sku = 'POL-SED-COM'; name = 'Polarizado Completo Sedan / Auto' }
$suvTint = @{ sku = 'POL-SUV-COM'; name = 'Polarizado Completo SUV / Station Wagon' }
$delTint = @{ sku = 'POL-DEL-001'; name = 'Polarizado Solo Vidrios Delanteros' }
$fraTint = @{ sku = 'POL-FRA-SUP'; name = 'Franja Superior Parabrisas' }

$testVehicles = @(
    @{ name = 'Toyota Tacoma 2022 (con vehicle_type_slug=sedan de OCR previo)'; brand = 'TOYOTA'; model = 'Tacoma'; year = 2022; chasis = '3TMCZ5AN3NM246316'; vehicle_type_slug = 'sedan' },
    @{ name = 'Toyota Tacoma 2022 (sin slug)'; brand = 'TOYOTA'; model = 'Tacoma'; year = 2022; vehicle_type_slug = '' },
    @{ name = 'Toyota Hilux 2024 (con slug=sedan)'; brand = 'TOYOTA'; model = 'Hilux'; year = 2024; vehicle_type_slug = 'sedan' },
    @{ name = 'Nissan Frontier 2023'; brand = 'NISSAN'; model = 'Frontier'; year = 2023; vehicle_type_slug = '' },
    @{ name = 'Toyota RAV4 2023'; brand = 'TOYOTA'; model = 'RAV4'; year = 2023; vehicle_type_slug = 'sedan' },
    @{ name = 'Hyundai Elantra 2022'; brand = 'HYUNDAI'; model = 'Elantra'; year = 2022; vehicle_type_slug = 'sedan' }
)

Write-Host '=========================================================================='
Write-Host 'EJECUTANDO SUITE DE PRUEBAS DE COMPATIBILIDAD DE POLARIZADOS'
Write-Host '=========================================================================='

$allPassed = $true
foreach ($v in $testVehicles) {
    $cat = Resolve-VehicleCategory $v
    $compPck = Get-ProductVehicleCompatibility $pckTint $v
    $compSed = Get-ProductVehicleCompatibility $sedTint $v
    $compSuv = Get-ProductVehicleCompatibility $suvTint $v
    $compDel = Get-ProductVehicleCompatibility $delTint $v
    $compFra = Get-ProductVehicleCompatibility $fraTint $v

    Write-Host '--------------------------------------------------------------------------'
    Write-Host ('Vehiculo: ' + $v.name)
    Write-Host ('  -> Categoria Resuelta: ' + $cat)
    Write-Host ('  -> POL-PCK-COM (Pickup): ' + $compPck.isCompatible + ' (' + $compPck.badge + ')')
    Write-Host ('  -> POL-SED-COM (Sedan):  ' + $compSed.isCompatible + ' (' + $compSed.badge + ')')
    Write-Host ('  -> POL-SUV-COM (SUV):    ' + $compSuv.isCompatible + ' (' + $compSuv.badge + ')')
    Write-Host ('  -> POL-DEL-001 (Delan):  ' + $compDel.isCompatible + ' (' + $compDel.badge + ')')
    Write-Host ('  -> POL-FRA-SUP (Franja): ' + $compFra.isCompatible + ' (' + $compFra.badge + ')')

    if ($v.model -match 'Tacoma|Hilux|Frontier') {
        if (-not $compPck.isCompatible -or -not $compDel.isCompatible -or -not $compFra.isCompatible -or $compSed.isCompatible) {
            Write-Host '  [ERROR] Fallo la verificacion para Pickup!'
            $allPassed = $false
        } else {
            Write-Host '  [OK] PASO CORRECTAMENTE'
        }
    } elseif ($v.model -match 'RAV4') {
        if (-not $compSuv.isCompatible -or $compPck.isCompatible -or $compSed.isCompatible) {
            Write-Host '  [ERROR] Fallo la verificacion para SUV!'
            $allPassed = $false
        } else {
            Write-Host '  [OK] PASO CORRECTAMENTE'
        }
    } elseif ($v.model -match 'Elantra') {
        if (-not $compSed.isCompatible -or $compPck.isCompatible -or $compSuv.isCompatible) {
            Write-Host '  [ERROR] Fallo la verificacion para Sedan!'
            $allPassed = $false
        } else {
            Write-Host '  [OK] PASO CORRECTAMENTE'
        }
    }
}

Write-Host '=========================================================================='
if ($allPassed) {
    Write-Host 'RESULTADO: TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100% OK)'
} else {
    Write-Host 'RESULTADO: HUBO FALLOS EN LAS PRUEBAS'
}
Write-Host '=========================================================================='
