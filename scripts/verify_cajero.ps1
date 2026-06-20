$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8001/api'
$testName = 'TEST CAJERO'

function Test-ApiGet {
    param($Session, [string]$Url)
    try {
        Invoke-RestMethod -WebSession $Session -Uri $Url | Out-Null
        return 'OK(200)'
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        return "ERR($code)"
    }
}

Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($base + '/auth/pin/login') -Body (@{user_id='user_263b0074786b'; pin='91900009'} | ConvertTo-Json) -ContentType 'application/json' -SessionVariable hr | Out-Null
$users = Invoke-RestMethod -WebSession $hr -Uri ($base + '/users')
$testUser = $users | Where-Object { $_.name -eq $testName } | Select-Object -First 1

if ($testUser) {
    Invoke-RestMethod -WebSession $hr -Method Delete -Uri ($base + '/users/pin/' + $testUser.user_id) | Out-Null
}

$pin = (Get-Random -Minimum 93000000 -Maximum 93999999).ToString()
$testUser = $null
for ($i = 0; $i -lt 8; $i++) {
    try {
        $created = Invoke-RestMethod -WebSession $hr -Method Post -Uri ($base + '/users/pin') -Body (@{name=$testName; role='cajero'; pin=$pin} | ConvertTo-Json) -ContentType 'application/json'
        $testUser = $created
        break
    }
    catch {
        if ($_.ErrorDetails.Message -notmatch 'PIN ya está en uso') { throw }
        $pin = (Get-Random -Minimum 93000000 -Maximum 93999999).ToString()
    }
}
if (-not $testUser) { throw 'No se pudo crear usuario TEST CAJERO con PIN único' }

Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($base + '/auth/pin/login') -Body (@{user_id=$testUser.user_id; pin=$pin} | ConvertTo-Json) -ContentType 'application/json' -SessionVariable caj | Out-Null
$me = Invoke-RestMethod -WebSession $caj -Uri ($base + '/auth/me')
$perms = Invoke-RestMethod -WebSession $caj -Uri ($base + '/permissions/me')

Write-Output ('USER_ID=' + $testUser.user_id)
Write-Output ('PIN=' + $pin)
Write-Output ('ROLE=' + $me.role)
Write-Output ('PERM users.view=' + $perms.effective_permissions.administracion.users.view)
Write-Output ('PERM sales.create=' + $perms.effective_permissions.ventas.sales.create)
Write-Output ('PERM customers.view=' + $perms.effective_permissions.clientes.customers.view)
Write-Output ('PERM inventory.view=' + $perms.effective_permissions.inventario.inventory.view)
Write-Output ('API /users=' + (Test-ApiGet -Session $caj -Url ($base + '/users')))
Write-Output ('API /permissions/roles=' + (Test-ApiGet -Session $caj -Url ($base + '/permissions/roles')))
Write-Output ('API /customers=' + (Test-ApiGet -Session $caj -Url ($base + '/customers')))
Write-Output ('API /sales=' + (Test-ApiGet -Session $caj -Url ($base + '/sales')))
Write-Output ('API /inventory=' + (Test-ApiGet -Session $caj -Url ($base + '/inventory')))
