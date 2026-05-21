[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot "projeto-salao"

function Move-RepoItem {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    return
  }

  $sourceItem = Get-Item -LiteralPath $SourcePath -Force
  $destinationExists = Test-Path -LiteralPath $DestinationPath

  if ($sourceItem.PSIsContainer) {
    if ($destinationExists) {
      $destinationItem = Get-Item -LiteralPath $DestinationPath -Force
      if (-not $destinationItem.PSIsContainer) {
        throw "Nao foi possivel mover '$SourcePath' porque '$DestinationPath' ja existe como arquivo."
      }

      foreach ($child in Get-ChildItem -LiteralPath $SourcePath -Force) {
        Move-RepoItem -SourcePath $child.FullName -DestinationPath (Join-Path $DestinationPath $child.Name)
      }

      $remainingChildren = @(Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue)
      if ($remainingChildren.Count -eq 0) {
        Remove-Item -LiteralPath $SourcePath -Force
      }

      return
    }

    Move-Item -LiteralPath $SourcePath -Destination $DestinationPath
    return
  }

  if ($destinationExists) {
    $destinationItem = Get-Item -LiteralPath $DestinationPath -Force
    if ($destinationItem.PSIsContainer) {
      throw "Nao foi possivel sobrescrever a pasta '$DestinationPath' com o arquivo '$SourcePath'."
    }

    Remove-Item -LiteralPath $DestinationPath -Force
  }

  Move-Item -LiteralPath $SourcePath -Destination $DestinationPath
}

Write-Host "Repositorio raiz: $repoRoot"

if (Test-Path -LiteralPath $sourceDir) {
  Write-Host "Movendo arquivos de '$sourceDir' para '$repoRoot'..."

  foreach ($item in Get-ChildItem -LiteralPath $sourceDir -Force) {
    Move-RepoItem -SourcePath $item.FullName -DestinationPath (Join-Path $repoRoot $item.Name)
  }

  $remainingItems = @(Get-ChildItem -LiteralPath $sourceDir -Force -ErrorAction SilentlyContinue)
  if ($remainingItems.Count -gt 0) {
    $remainingNames = $remainingItems | Select-Object -ExpandProperty FullName
    throw "A pasta projeto-salao ainda contem itens apos a migracao:`n$($remainingNames -join "`n")"
  }

  Remove-Item -LiteralPath $sourceDir -Force
  Write-Host "Pasta 'projeto-salao' removida com sucesso."
} else {
  Write-Host "A pasta 'projeto-salao' nao existe. Assumindo que a migracao para a raiz ja foi concluida."
}

if ($SkipInstall) {
  Write-Host "Instalacao de dependencias ignorada por causa do parametro -SkipInstall."
  exit 0
}

$rootNodeModules = Join-Path $repoRoot "node_modules"

Push-Location $repoRoot
try {
  if (Test-Path -LiteralPath $rootNodeModules) {
    Write-Host "Removendo node_modules da raiz para reconstruir no local definitivo..."
    Remove-Item -LiteralPath $rootNodeModules -Recurse -Force
  }

  Write-Host "Executando npm install na raiz..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install falhou com codigo $LASTEXITCODE."
  }

  Write-Host "Executando npm install googleapis na raiz..."
  npm install googleapis
  if ($LASTEXITCODE -ne 0) {
    throw "npm install googleapis falhou com codigo $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

Write-Host "Migracao concluida. Agora voce pode rodar 'npm run dev' diretamente em '$repoRoot'."