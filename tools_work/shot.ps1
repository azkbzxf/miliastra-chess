# 用真实 Edge 打开本地 HTML，只截浏览器窗口并保存（不是无头浏览器）
# 用法：pwsh -NoProfile -File tools_work/shot.ps1 -Url "http://..." -Out "D:\\...\\x.png" -WaitSec 6 [-TitleContains "黑白棋局"]
#
# 【重要 1】必须按窗口标题精确匹配目标窗口。
#   教训：早期版本在拿不到 MainWindowHandle 时退化为「取任意 msedge 主窗口」，
#   机器上还开着别的 Edge 窗口时会截到别人的页面（实测截到 WinIsland 页面）。
#
# 【重要 2】必须用 PrintWindow 而不是 CopyFromScreen。
#   教训：CopyFromScreen 抓的是屏幕像素，别的窗口（Steam 设置窗等）盖在上面时
#   会被一起截进来，画面被遮挡。PrintWindow 直接让目标窗口自己绘制到位图，
#   不受遮挡影响。
#
# 【重要 3】尺寸用 PrintWindow 得到的位图尺寸，并裁掉不可见的窗口阴影/边框偏移。
param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$Out,
    [int]$WaitSec = 6,
    [int]$Width = 1600,
    [int]$Height = 900,
    [string]$TitleContains = ""
)

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { Write-Error "Edge 未找到"; exit 3 }

$profileDir = Join-Path $env:TEMP "edge_shot_profile"
$argList = @(
    "--user-data-dir=$profileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,msEdgeSidebarV2",
    "--force-device-scale-factor=1",
    "--window-size=$Width,$Height",
    "--window-position=0,0",
    "--app=$Url"
)
$proc = Start-Process -FilePath $edge -ArgumentList $argList -PassThru
Start-Sleep -Seconds $WaitSec

Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Win32Shot {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int max);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  public delegate bool EnumProc(IntPtr hWnd, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static List<string> Find(uint targetPid, string titlePart) {
    List<string> hits = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr p) {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      int len = GetWindowTextLength(h);
      if (len <= 0) return true;
      StringBuilder sb = new StringBuilder(len + 2);
      GetWindowText(h, sb, len + 2);
      string t = sb.ToString();
      bool okPid = (targetPid != 0 && pid == targetPid);
      bool okTitle = (titlePart.Length > 0 && t.Contains(titlePart));
      if (okPid || okTitle) hits.Add(h.ToInt64() + "|" + pid + "|" + t);
      return true;
    }, IntPtr.Zero);
    return hits;
  }
}
"@

# 枚举候选窗口：标题命中优先，其次同进程
$candsPid = [Win32Shot]::Find([uint32]$proc.Id, "")
$candsTitle = @()
if ($TitleContains -ne "") { $candsTitle = [Win32Shot]::Find([uint32]0, $TitleContains) }
if ($candsPid.Count -eq 0 -and $candsTitle.Count -eq 0) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    Write-Error "未找到目标窗口（title=$TitleContains, pid=$($proc.Id)）—— 拒绝截屏"
    exit 4
}

$hwnd = [IntPtr]::Zero
$bestScore = [double]::MaxValue
$rect = New-Object Win32Shot+RECT
$expectedArea = $Width * $Height
$all = @()
$all += $candsTitle
$all += $candsPid
foreach ($c in $all) {
    $parts = $c.Split("|")
    $h = [IntPtr][int64]$parts[0]
    $t = if ($parts.Length -ge 3) { $parts[2] } else { "" }
    $r = New-Object Win32Shot+RECT
    if (-not [Win32Shot]::GetWindowRect($h, [ref]$r)) { continue }
    $w2 = $r.Right - $r.Left; $h2 = $r.Bottom - $r.Top
    if ($w2 -le 200 -or $h2 -le 200) { continue }
    $isTitle = ($TitleContains -ne "" -and $t.Contains($TitleContains))
    $score = [math]::Abs(($w2 * $h2) - $expectedArea)
    if (-not $isTitle) { $score = $score + 100000000 }
    if ($score -lt $bestScore) { $bestScore = $score; $hwnd = $h; $rect = $r }
}
if ($hwnd -eq [IntPtr]::Zero) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    Write-Error "候选窗口尺寸都无效 —— 拒绝截屏"
    exit 4
}

[Win32Shot]::ShowWindow($hwnd, 9) | Out-Null
[Win32Shot]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800
[Win32Shot]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

$w = $rect.Right - $rect.Left
$h2 = $rect.Bottom - $rect.Top

# PrintWindow(PW_RENDERFULLCONTENT=2)：让目标窗口自己绘制，不受其它窗口遮挡
$bmp = New-Object System.Drawing.Bitmap($w, $h2)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [Win32Shot]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()

# 兜底：PrintWindow 失败（个别 GPU 合成窗口）才回退屏幕抓取
if (-not $ok) {
    $bmp.Dispose()
    $bmp = New-Object System.Drawing.Bitmap($w, $h2)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h2)))
    $g.Dispose()
}

$dir = Split-Path -Parent $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
Write-Output ("SHOT_SAVED|" + $Out + "|" + $w + "x" + $h2 + "|hwnd=" + $hwnd + "|printwindow=" + $ok + "|cands=" + $all.Count)
