param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [int]$WaitMs = 1500,
  [int]$Times = 2
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Dd {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [Dd]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Dd]::SetProcessDPIAware() } } catch { [void][Dd]::SetProcessDPIAware() }

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Cd {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  public struct POINT { public int X, Y; }
}
"@

$script:gh = [IntPtr]::Zero
$cb = [Cd+EnumProc]{
  param($h, $p)
  if (-not [Cd]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][Cd]::GetClassNameW($h, $cn, 256)
  if ($cn.ToString() -eq 'UnityWndClass') {
    $procId = 0; [void][Cd]::GetWindowThreadProcessId($h, [ref]$procId)
    try { if ((Get-Process -Id $procId -ErrorAction Stop).ProcessName -eq 'YuanShen') { $script:gh = $h } } catch {}
  }
  return $true
}
[void][Cd]::EnumWindows($cb, [IntPtr]::Zero)
$hwnd = $script:gh
if ($hwnd -eq [IntPtr]::Zero) { Write-Output "!! no window"; exit 1 }

[void][Cd]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 300

$pt = New-Object Cd+POINT
$pt.X = $X; $pt.Y = $Y
[void][Cd]::ClientToScreen($hwnd, [ref]$pt)
[void][Cd]::SetCursorPos($pt.X, $pt.Y)
Start-Sleep -Milliseconds 220

for ($i = 0; $i -lt $Times; $i++) {
  [void][Cd]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [void][Cd]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 110
}
Write-Output ("dblclick client({0},{1}) x{2}" -f $X, $Y, $Times)
Start-Sleep -Milliseconds $WaitMs
