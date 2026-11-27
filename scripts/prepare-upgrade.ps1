param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit)
$ErrorActionPreference='Stop'
$repo='FUNDACIONECOPIENSAEVOLUTION/ECOAGENT-Open-Source-Browser-Automation'
$headers=@{'User-Agent'='ECOAGENT-bootstrap'}
$base="https://api.github.com/repos/$repo"
$run=Invoke-RestMethod "$base/actions/runs?head_sha=$Commit&event=push&per_page=100" -Headers $headers
if(!(@($run.workflow_runs|Where-Object {$_.head_sha -eq $Commit -and $_.name -eq 'ECOAGENT verification' -and $_.conclusion -eq 'success'}).Count)){throw 'Revision has no successful CI'}
$revision=Invoke-RestMethod "$base/commits/$Commit" -Headers $headers
if($revision.sha -ne $Commit){throw 'Revision mismatch'}
$tree=Invoke-RestMethod "$base/git/trees/$($revision.commit.tree.sha)?recursive=1" -Headers $headers
if($tree.truncated){throw 'Incomplete tree'}
$dir=Join-Path $env:TEMP ('ecoagent-bootstrap-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $dir|Out-Null
try {
 foreach($path in @('actualizar-ecoagent.ps1','scripts/install-release.ps1')){
  $entry=@($tree.tree|Where-Object {$_.path -eq $path -and $_.type -eq 'blob' -and $_.mode -eq '100644'})
  if($entry.Count -ne 1){throw 'Missing installer'}
  $target=Join-Path $dir (Split-Path $path -Leaf)
  Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/$repo/$Commit/$path" -OutFile $target
  $bytes=[IO.File]::ReadAllBytes($target)
  $prefix=[Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)"+[char]0)
  $hash=[Security.Cryptography.SHA1]::Create()
  try{$hash.TransformBlock($prefix,0,$prefix.Length,$prefix,0)|Out-Null;$hash.TransformFinalBlock($bytes,0,$bytes.Length)|Out-Null;$got=([BitConverter]::ToString($hash.Hash)).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
  if($got -ne $entry[0].sha){throw 'Installer hash mismatch'}
 }
 Write-Host "Verified installer files: $dir"
 Write-Host 'Review the verified files before executing. No installed files or runtime changed.'
} catch {Remove-Item -LiteralPath $dir -Recurse -Force;throw}
