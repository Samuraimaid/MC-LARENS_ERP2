# PowerShell script to thoroughly scrub China origin and "Detalles rapidos" from all local seed files
$seedPath = "c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\seeds\all_catalogs_unified_seed.json"
$reportPath1 = "c:\ANTIGRAVITY\MC-LARENS_ERP2\scripts\reports\SCRUB_CHINA_ORIGIN_20260919.json"
$reportPath2 = "c:\ANTIGRAVITY\MC-LARENS_ERP2\docs\SCRUB_CHINA_ORIGIN_20260919.json"

if (-not (Test-Path $seedPath)) {
    Write-Error "Seed file not found: $seedPath"
    exit 1
}

$rawJson = [System.IO.File]::ReadAllText($seedPath, [System.Text.Encoding]::UTF8)
$products = $rawJson | ConvertFrom-Json

$chinaPatterns = @(
    "(?i)detalles\s+r\w*pidos\s+lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b",
    "(?i)detalles\s+r\w*pidos\s+lugar\s+de\s+origen\s*:\s*china\b",
    "(?i)detalles\s+r\w*pidos\s+origen\s*:\s*guangdong[,\s]*china\b",
    "(?i)detalles\s+r\w*pidos\s+origen\s*:\s*china\b",
    "(?i)lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b",
    "(?i)lugar\s+de\s+origen\s*:\s*china\b",
    "(?i)origen\s*:\s*guangdong[,\s]*china\b",
    "(?i)origen\s*:\s*china\b",
    "(?i)place\s+of\s+origin\s*:\s*guangdong[,\s]*china\b",
    "(?i)place\s+of\s+origin\s*:\s*china\b",
    "(?i)country\s+of\s+origin\s*:\s*china\b",
    "(?i)made\s+in\s+china\b",
    "(?i)hecho\s+en\s+china\b",
    "(?i)fabricado\s+en\s+china\b",
    "(?i)guangdong[,\s]+china\b"
)

function Clean-Text([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $text }
    $c = $text
    foreach ($pat in $chinaPatterns) {
        $c = [regex]::Replace($c, $pat, "")
    }
    # Clean up empty or dangling "Detalles rápidos" header
    $c = [regex]::Replace($c, "(?i)detalles\s+r\w*pidos\s*[:\s-]*\r?\n?", "")
    $c = [regex]::Replace($c, "(?i)detalles\s+r\w*pidos\s*[:\s-]*", "")
    
    # Clean multiple empty lines and excessive spaces
    $c = [regex]::Replace($c, "(?m)^\s+$", "")
    $c = [regex]::Replace($c, "\n{3,}", "`n`n")
    $c = [regex]::Replace($c, "[ \t]{2,}", " ")
    return $c.Trim()
}

$total = $products.Count
$modifiedCount = 0
$samples = @()

for ($i = 0; $i -lt $total; $i++) {
    $p = $products[$i]
    $origDesc = if ($p.description) { $p.description } else { "" }
    
    $hasChina = $false
    if ($origDesc -match "(?i)china" -or $origDesc -match "(?i)guangdong" -or $origDesc -match "(?i)detalles\s+r\w*pidos") {
        $hasChina = $true
    }
    
    # Check specs / specifications
    foreach ($field in @("specs", "specifications", "attributes")) {
        if ($p.PSObject.Properties[$field] -and $p.$field) {
            $obj = $p.$field
            foreach ($prop in @($obj.PSObject.Properties)) {
                if ($prop.Name -match "(?i)^(lugar de origen|origen|place of origin|country of origin)$") {
                    if ($prop.Value -match "(?i)(china|guangdong)") {
                        $hasChina = $true
                        $obj.PSObject.Properties.Remove($prop.Name)
                    }
                }
            }
        }
    }
    
    # Clean description
    if ($p.description) {
        $cleanDesc = Clean-Text $p.description
        if ($cleanDesc -ne $p.description) {
            $p.description = $cleanDesc
        }
    }
    
    # Clean name if needed
    if ($p.name) {
        $cleanName = Clean-Text $p.name
        if ($cleanName -ne $p.name) {
            $p.name = $cleanName
        }
    }
    
    # If tagged or had china, count as modified
    $existingTags = @()
    if ($p.PSObject.Properties['tags'] -and $p.tags) {
        $existingTags = @($p.tags)
    }
    
    if ($hasChina -or $existingTags -contains "scrub_china_origin_20260919") {
        $modifiedCount++
        
        if ($existingTags -notcontains "scrub_china_origin_20260919") {
            $existingTags += "scrub_china_origin_20260919"
        }
        if ($p.PSObject.Properties['tags']) {
            $p.tags = $existingTags
        } else {
            $p | Add-Member -NotePropertyName "tags" -NotePropertyValue $existingTags -Force
        }
        
        if ($samples.Count -lt 15) {
            $beforeSnippet = if ($origDesc.Length -gt 120) { $origDesc.Substring(0, 120) + "..." } else { $origDesc }
            $afterSnippet = if ($p.description -and $p.description.Length -gt 120) { $p.description.Substring(0, 120) + "..." } else { $p.description }
            $samples += @{
                product_id = $p.product_id
                sku = $p.sku
                name = $p.name
                before_description = $beforeSnippet
                after_description = $afterSnippet
            }
        }
    }
}

$outputJson = $products | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($seedPath, $outputJson, [System.Text.Encoding]::UTF8)

$report = @{
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    tag = "scrub_china_origin_20260919"
    total_products_checked = $total
    products_modified = $modifiedCount
    samples = $samples
}

$reportJson = $report | ConvertTo-Json -Depth 10

$reportDir1 = Split-Path $reportPath1
if (-not (Test-Path $reportDir1)) { New-Item -ItemType Directory -Path $reportDir1 -Force | Out-Null }
[System.IO.File]::WriteAllText($reportPath1, $reportJson, [System.Text.Encoding]::UTF8)

$reportDir2 = Split-Path $reportPath2
if (-not (Test-Path $reportDir2)) { New-Item -ItemType Directory -Path $reportDir2 -Force | Out-Null }
[System.IO.File]::WriteAllText($reportPath2, $reportJson, [System.Text.Encoding]::UTF8)

Write-Host "Scrub complete! Modified $modifiedCount / $total products in $seedPath"
Write-Host "Reports saved to $reportPath1 and $reportPath2"
