param(
  [int]$X = 200, [int]$Y = 600,
  [int]$Ticks = 3,
  [int]$WaitMs = 700,
  [string]$Out = "tools_work\win\shots\sc.png",
  [string]$Crop = ""
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Dw {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [Dw]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Dw]::SetProcessDPIAware() } } catch { [void][Dw]::SetProcessDPIAware() }

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Cw {
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
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
"@

$script:gh = [IntPtr]::Zero
$cb = [Cw+EnumProc]{
  param($h, $p)
  if (-not [Cw]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][Cw]::GetClassNameW($h, $cn, 256)
  if ($cn.ToString() -eq 'UnityWndClass') {
    $procId = 0; [void][Cw]::GetWindowThreadProcessId($h, [ref]$procId)
    try { if ((Get-Process -Id $procId -ErrorAction Stop).ProcessName -eq 'YuanShen') { $script:gh = $h } } catch {}
  }
  return $true
}
[void][Cw]::EnumWindows($cb, [IntPtr]::Zero)
$hwnd = $script:gh
if ($hwnd -eq [IntPtr]::Zero) { Write-Output "!! no window"; exit 1 }

[void][Cw]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 250

$pt = New-Object Cw+POINT
$pt.X = $X; $pt.Y = $Y
[void][Cw]::ClientToScreen($hwnd, [ref]$pt)
[void][Cw]::SetCursorPos($pt.X, $pt.Y)
Start-Sleep -Milliseconds 200
for ($i = 0; $i -lt $Ticks; $i++) {
  [void][Cw]::mouse_event(0x0800, 0, 0, 120, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 90
}
Start-Sleep -Milliseconds $WaitMs

$wr = New-Object Cw+RECT; [void][Cw]::GetWindowRect($hwnd, [ref]$wr)
$cr = New-Object Cw+RECT; [void][Cw]::GetClientRect($hwnd, [ref]$cr)
$cpt = New-Object Cw+POINT; [void][Cw]::ClientToScreen($hwnd, [ref]$cpt)
$winW = $wr.Right - $wr.Left; $winH = $wr.Bottom - $wr.Top
$offX = $cpt.X - $wr.Left; $offY = $cpt.Y - $wr.Top

$bmp = New-Object System.Drawing.Bitmap $winW, $winH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[void][Cw]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc); $g.Dispose()
$rect = New-Object System.Drawing.Rectangle $offX, $offY, $cr.Right, $cr.Bottom
$client = $bmp.Clone($rect, $bmp.PixelFormat)
New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
$full = Join-Path (Resolve-Path (Split-Path $Out)).Path (Split-Path $Out -Leaf)
if ($Crop -ne "") {
  $p = $Crop.Split(',')
  $r2 = New-Object System.Drawing.Rectangle ([int]$p[0]), ([int]$p[1]), ([int]$p[2]), ([int]$p[3])
  $sub = $client.Clone($r2, $client.PixelFormat)
  $sub.Save($full, [System.Drawing.Imaging.ImageFormat]::Png); $sub.Dispose()
} else {
  $client.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
}
Write-Output ("scrolled {0} ticks at ({1},{2}) -> {3}" -f $Ticks, $X, $Y, $Out)
$client.Dispose(); $bmp.Dispose()
