# Basic Security Validation Script

param([string]$ApiBaseUrl = "http://localhost:5000")

Write-Host "Security and Access Control Validation" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$passed = 0
$failed = 0
$total = 0

function Test-SecurityEndpoint {
    param([string]$name, [string]$uri, [int]$expectedStatus)
    
    $script:total++
    
    try {
        $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -ErrorAction Stop
        $status = $response.StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            $status = 0
        }
    }
    
    if ($status -eq $expectedStatus) {
        Write-Host "PASS | $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "FAIL | $name (Expected: $expectedStatus, Got: $status)" -ForegroundColor Red
        $script:failed++
    }
}

# Check server accessibility
Write-Host "`nChecking server..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$ApiBaseUrl/api/health" -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "Server is accessible" -ForegroundColor Green
}
catch {
    Write-Host "Server not accessible - please start with 'pnpm dev'" -ForegroundColor Red
    exit 1
}

Write-Host "`nTesting Authentication Requirements..." -ForegroundColor Yellow

# Test endpoints without authentication
Test-SecurityEndpoint "Upload without auth" "$ApiBaseUrl/api/upload" 401
Test-SecurityEndpoint "Profile without auth" "$ApiBaseUrl/api/auth/user" 401

$today = (Get-Date).ToString("yyyy-MM-dd")
Test-SecurityEndpoint "Journal without auth" "$ApiBaseUrl/api/journal/$today" 401

# Test with invalid tokens
$headers = @{"Authorization" = "Bearer invalid-token"}
try {
    $response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/auth/user" -Headers $headers -UseBasicParsing -ErrorAction Stop
    Write-Host "FAIL | Invalid token test (Should have been rejected)" -ForegroundColor Red
    $failed++
}
catch {
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) {
        Write-Host "PASS | Invalid token test" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAIL | Invalid token test (Unexpected error)" -ForegroundColor Red
        $failed++
    }
}
$total++

Write-Host "`nTesting Error Handling..." -ForegroundColor Yellow
Test-SecurityEndpoint "Non-existent endpoint" "$ApiBaseUrl/api/nonexistent" 404

Write-Host "`nTesting Server Configuration..." -ForegroundColor Yellow
Test-SecurityEndpoint "Health endpoint" "$ApiBaseUrl/api/health" 200

# Results
Write-Host "`nResults:" -ForegroundColor Cyan
Write-Host "========" -ForegroundColor Cyan
Write-Host "Total: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

$rate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }
Write-Host "Success Rate: $rate%" -ForegroundColor $(if ($rate -ge 90) { "Green" } elseif ($rate -ge 70) { "Yellow" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "`n✅ Basic security tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some tests failed - review security implementation" -ForegroundColor Red
}

Write-Host "`nFor comprehensive testing, see SECURITY_CHECKLIST.md" -ForegroundColor Blue

exit $(if ($failed -gt 0) { 1 } else { 0 })