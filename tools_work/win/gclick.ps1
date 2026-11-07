param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [int]$WaitMs = 1200,
  [switch]$Force,
  [switch]$NoRestore
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Dz {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [Dz]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Dz]::SetProcessDPIAware() } } catch { [void][Dz]::SetProcessDPIAware() }

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Cz {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
"@

# 目标 = 原神 UnityWndClass
$script:gameHwnd = [IntPtr]::Zero
$cb = [Cz+EnumProc]{
  param($h, $p)
  if (-not [Cz]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][Cz]::GetClassNameW($h, $cn, 256)
  if ($cn.ToString() -eq 'UnityWndClass') {
    $procId = 0; [void][Cz]::GetWindowThreadProcessId($h, [ref]$procId)
    try { if ((Get-Process -Id $procId -ErrorAction Stop).ProcessName -eq 'YuanShen') { $script:gameHwnd = $h } } catch {}
  }
  return $true
}
[void][Cz]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:gameHwnd -eq [IntPtr]::Zero) { Write-Output "!! 未找到原神窗口"; exit 1 }

$hwnd = $script:gameHwnd
if (-not $Force) {
  if ([Cz]::GetForegroundWindow() -ne $hwnd) {
    [void][Cz]::ShowWindow($hwnd, 9)
    [void][Cz]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 350
  }
}

# 客户区坐标 -> 屏幕坐标
$pt = New-Object Cz+POINT
$pt.X = $X; $pt.Y = $Y
[void][Cz]::ClientToScreen($hwnd, [ref]$pt)

$orig = New-Object Cz+POINT
[void][Cz]::GetCursorPos([ref]$orig)

[void][Cz]::SetCursorPos($pt.X, $pt.Y)
Start-Sleep -Milliseconds 240
[void][Cz]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 70
[void][Cz]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)

Write-Output ("click client({0},{1}) -> screen({2},{3})" -f $X, $Y, $pt.X, $pt.Y)
Start-Sleep -Milliseconds $WaitMs

if (-not $NoRestore) { [void][Cz]::SetCursorPos($orig.X, $orig.Y) }
