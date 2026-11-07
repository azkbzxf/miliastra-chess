param(
  [string]$Keys = "{DOWN}",
  [int]$WaitMs = 900,
  [string]$Out = "tools_work\win\shots\k.png",
  [string]$Crop = ""
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Dk {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [Dk]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Dk]::SetProcessDPIAware() } } catch { [void][Dk]::SetProcessDPIAware() }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Ck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
"@

$script:gh = [IntPtr]::Zero
$cb = [Ck+EnumProc]{
  param($h, $p)
  if (-not [Ck]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][Ck]::GetClassNameW($h, $cn, 256)
  if ($cn.ToString() -eq 'UnityWndClass') {
    $procId = 0; [void][Ck]::GetWindowThreadProcessId($h, [ref]$procId)
    try { if ((Get-Process -Id $procId -ErrorAction Stop).ProcessName -eq 'YuanShen') { $script:gh = $h } } catch {}
  }
  return $true
}
[void][Ck]::EnumWindows($cb, [IntPtr]::Zero)
$hwnd = $script:gh
if ($hwnd -eq [IntPtr]::Zero) { Write-Output "!! no game window"; exit 1 }

[void][Ck]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Start-Sleep -Milliseconds $WaitMs

$wr = New-Object Ck+RECT; [void][Ck]::GetWindowRect($hwnd, [ref]$wr)
$cr = New-Object Ck+RECT; [void][Ck]::GetClientRect($hwnd, [ref]$cr)
$pt = New-Object Ck+POINT; [void][Ck]::ClientToScreen($hwnd, [ref]$pt)
$winW = $wr.Right - $wr.Left; $winH = $wr.Bottom - $wr.Top
$offX = $pt.X - $wr.Left; $offY = $pt.Y - $wr.Top

$bmp = New-Object System.Drawing.Bitmap $winW, $winH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[void][Ck]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc); $g.Dispose()
$rect = New-Object System.Drawing.Rectangle $offX, $offY, $cr.Right, $cr.Bottom
$client = $bmp.Clone($rect, $bmp.PixelFormat)

if ($Crop -ne "") {
  $p = $Crop.Split(',')
  $r2 = New-Object System.Drawing.Rectangle ([int]$p[0]), ([int]$p[1]), ([int]$p[2]), ([int]$p[3])
  $sub = $client.Clone($r2, $client.PixelFormat)
  $scale = [Math]::Min(4.0, 1400.0 / $sub.Width)
  $big = New-Object System.Drawing.Bitmap ([int]($sub.Width*$scale)), ([int]($sub.Height*$scale))
  $g2 = [System.Drawing.Graphics]::FromImage($big)
  $g2.InterpolationMode = 'HighQualityBicubic'
  $g2.DrawImage($sub, 0, 0, $big.Width, $big.Height)
  $g2.Dispose()
  New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
  $big.Save((Join-Path (Resolve-Path (Split-Path $Out)).Path (Split-Path $Out -Leaf)), [System.Drawing.Imaging.ImageFormat]::Png)
  $big.Dispose(); $sub.Dispose()
  Write-Output "keys=$Keys  crop -> $Out"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
  $client.Save((Join-Path (Resolve-Path (Split-Path $Out)).Path (Split-Path $Out -Leaf)), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "keys=$Keys  full -> $Out"
}
$client.Dispose(); $bmp.Dispose()
