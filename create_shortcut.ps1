# Create desktop shortcut with custom icon for Tilt to Live
$ErrorActionPreference = "Stop"
$desktop = [Environment]::GetFolderPath("Desktop")
$icoPath = "D:\JasonCoding\tilt_to_live\icon.ico"
# Chinese filename built from Unicode code points, so this script stays ASCII-safe
$lnkName = "Tilt_to_Live_" + [char]0x9F20 + [char]0x6807 + [char]0x7248 + ".lnk"
$lnkPath = Join-Path $desktop $lnkName

Add-Type -AssemblyName System.Drawing

# 64x64 icon design: navy circle + blue ring + white arrow (player) + red dot (enemy)
$bmp = [System.Drawing.Bitmap]::new(64, 64)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$navy = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 22, 64))
$g.FillEllipse($navy, 4, 4, 56, 56)

$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 110, 160, 255), 3)
$g.DrawEllipse($pen, 6, 6, 52, 52)

$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$g.FillPolygon($white, [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(20, 18),
  [System.Drawing.PointF]::new(20, 46),
  [System.Drawing.PointF]::new(46, 32)
))

$red = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 82, 82))
$g.FillEllipse($red, 42, 10, 13, 13)

$g.Dispose()

# Save as .ico
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$bmp.Dispose()

# Create .lnk shortcut
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath = "D:\JasonCoding\tilt_to_live\tilt.html"
$sc.WorkingDirectory = "D:\JasonCoding\tilt_to_live"
$sc.IconLocation = "$icoPath,0"
$sc.Description = "Tilt to Live - Mouse Edition"
$sc.Save()

# Remove old temporary .url shortcut to avoid duplicates
Get-ChildItem -Path $desktop -Filter "Tilt_to_Live_*.url" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "Done: $lnkPath created. Icon: $icoPath"
