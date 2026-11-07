param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [int]$WaitMs = 3000
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Da {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
try { if (-not [Da]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Da]::SetProcessDPIAware() } } catch { [void][Da]::SetProcessDPIAware() }

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Ca {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
}
"@

$script:gh = [IntPtr]::Zero
$cb = [Ca+EnumProc]{
  param($h, $p)
  if (-not [Ca]::IsWindowVisible($h)) { return $true }
  $cn = New-Object System.Text.StringBuilder 256
  [void][Ca]::GetClassNameW($h, $cn, 256)
  if ($cn.ToString() -eq 'UnityWndClass') {
    $procId = 0; [void][Ca]::GetWindowThreadProcessId($h, [ref]$procId)
    try { if ((Get-Process -Id $procId -ErrorAction Stop).ProcessName -eq 'YuanShen') { $script:gh = $h } } catch {}
  }
  return $true
}
[void][Ca]::EnumWindows($cb, [IntPtr]::Zero)
$hwnd = $script:gh
if ($hwnd -eq [IntPtr]::Zero) { Write-Output "!! no window"; exit 1 }

# 强力前台化：AttachThreadInput + SetForegroundWindow
$fg = [Ca]::GetForegroundWindow()
$fgThread = [Ca]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
$myThread = [Ca]::GetCurrentThreadId()
$targetThread = [Ca]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
[void][Ca]::AttachThreadInput($myThread, $targetThread, $true)
[void][Ca]::AttachThreadInput($fgThread, $targetThread, $true)
[void][Ca]::ShowWindow($hwnd, 9)
[void][Ca]::BringWindowToTop($hwnd)
[void][Ca]::SetForegroundWindow($hwnd)
[void][Ca]::SetFocus($hwnd)
Start-Sleep -Milliseconds 500
[void][Ca]::AttachThreadInput($myThread, $targetThread, $false)
[void][Ca]::AttachThreadInput($fgThread, $targetThread, $false)

$now = [Ca]::GetForegroundWindow()
Write-Output ("foreground now = {0}  (target = {1})  match={2}" -f $now, $hwnd, ($now -eq $hwnd))
if ($now -ne $hwnd) { Write-Output "!! 无法置前，点击可能无效" }

$pt = New-Object Ca+POINT
$pt.X = $X; $pt.Y = $Y
[void][Ca]::ClientToScreen($hwnd, [ref]$pt)
[void][Ca]::SetCursorPos($pt.X, $pt.Y)
Start-Sleep -Milliseconds 350

[void][Ca]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 90
[void][Ca]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
Write-Output ("clicked client({0},{1}) -> screen({2},{3})" -f $X, $Y, $pt.X, $pt.Y)
Start-Sleep -Milliseconds $WaitMs
