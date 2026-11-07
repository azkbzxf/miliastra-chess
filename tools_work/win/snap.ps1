param(
  [string]$Out = "tools_work\win\shots\now.png",
  [switch]$Enum
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiZ {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [DpiZ]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][DpiZ]::SetProcessDPIAware() } } catch { [void][DpiZ]::SetProcessDPIAware() }

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WZ {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
"@

$rows = New-Object System.Collections.ArrayList
$cb = [WZ+EnumProc]{
  param($h, $p)
  if (-not [WZ]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][WZ]::GetWindowTextW($h, $sb, 512)
  $t = $sb.ToString()
  if ([string]::IsNullOrWhiteSpace($t)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][WZ]::GetClassNameW($h, $cn, 256)
  $r = New-Object WZ+RECT
  [void][WZ]::GetWindowRect($h, [ref]$r)
  $w = $r.Right - $r.Left; $hh = $r.Bottom - $r.Top
  if ($w -lt 150 -or $hh -lt 100) { return $true }
  $procId = 0; [void][WZ]::GetWindowThreadProcessId($h, [ref]$procId)
  $pn = ""
  try { $pn = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
  [void]$rows.Add([pscustomobject]@{ hwnd=[long]$h; Class=$cn.ToString(); Title=$t; Proc=$pn; X=$r.Left; Y=$r.Top; W=$w; H=$hh })
  return $true
}
[void][WZ]::EnumWindows($cb, [IntPtr]::Zero)

if ($Enum) {
  Write-Output "=== 可见窗口 ==="
  $rows | Sort-Object -Property W -Descending | Format-Table -AutoSize | Out-String -Width 180 | Write-Output
}

# 找原神主窗口
$target = $rows | Where-Object { $_.Proc -eq 'YuanShen' -and $_.Class -eq 'UnityWndClass' } | Select-Object -First 1
if (-not $target) { $target = $rows | Where-Object { $_.Proc -eq 'YuanShen' } | Select-Object -First 1 }
if (-not $target) { Write-Output "!! 没找到原神窗口"; exit 1 }

$hwnd = [IntPtr]$target.hwnd
$cr = New-Object WZ+RECT; [void][WZ]::GetClientRect($hwnd, [ref]$cr)
$pt = New-Object WZ+POINT; [void][WZ]::ClientToScreen($hwnd, [ref]$pt)

Write-Output ("原神 hwnd={0}  client={1}x{2}  clientOrigin=({3},{4})  前台={5}" -f `
  $target.hwnd, $cr.Right, $cr.Bottom, $pt.X, $pt.Y, ([WZ]::GetForegroundWindow() -eq $hwnd))

# 按窗口真实尺寸抓，再裁客户区
$wr = New-Object WZ+RECT; [void][WZ]::GetWindowRect($hwnd, [ref]$wr)
$winW = $wr.Right - $wr.Left; $winH = $wr.Bottom - $wr.Top
$offX = $pt.X - $wr.Left; $offY = $pt.Y - $wr.Top

$bmp = New-Object System.Drawing.Bitmap $winW, $winH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [WZ]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc); $g.Dispose()

$rect = New-Object System.Drawing.Rectangle $offX, $offY, $cr.Right, $cr.Bottom
$client = $bmp.Clone($rect, $bmp.PixelFormat)
New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
$full = Join-Path (Resolve-Path (Split-Path $Out)).Path (Split-Path $Out -Leaf)
$client.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("截图 -> {0}  ({1}x{2})  PrintWindow={3}" -f $full, $client.Width, $client.Height, $ok)
$client.Dispose(); $bmp.Dispose()
