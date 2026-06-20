param(
  [string]$ApiBase = "http://127.0.0.1:8001/api",
  [string]$SessionCookie
)

$ErrorActionPreference = "Stop"

$headers = @{}
if ($SessionCookie) {
  $headers["Cookie"] = "session_id=$SessionCookie"
}

$branches = Invoke-RestMethod -Method Get -Uri "$ApiBase/branches" -Headers $headers

$branches |
  Select-Object branch_id, name, branch_kind, @{N="installations_enabled";E={$_.service_policy.installations_enabled}}, @{N="tint_enabled";E={$_.service_policy.tint_enabled}} |
  Format-Table -AutoSize
