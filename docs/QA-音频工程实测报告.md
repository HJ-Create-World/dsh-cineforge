# CineForge QA · 音频工程实测报告（0.3.2）

> 本文由 audio-lab 独立子代理实测生成，原稿 `.local/audio-lab-report.md`（`.local/` 被 .gitignore 排除）。
> 0.3.2 提升到 `docs/` 随仓库交付，作为 `manifest.audio_alignment.evidence` 的证据文件。
> 硬约束：未改 scripts/、lib/、examples/、out/；未 render；未调用 git；未提权；未试听（如实保留）。

---
# CineForge 音频工程实测报告 · P1「音频验证闭环 / S5 / S4」

> 角色：音频工程分析员（只读调研）。本报告是**本任务唯一写入的文件**。
> 对应 `docs/QA-一期返工终检报告.md` §9 的两条 P1：
> ① 音频验证闭环（未试听 / 带·无 BGM 两版未渲 / S5 AAC priming 无实测值）；
> ② S4 拟音（`impact-cine.mp3` 4.063s 越过 s01 3s 边界 / 清单无逐条拟音 / 数字落定用通用 `swoosh-quick`）。
> 目标工程：`D:/01_HJ_Work/00_Person/04_Project/11_Creation/03_Video/02_MyWork/02_cineforge`

## 0. 口径、环境与合规声明

| 项 | 值 |
|---|---|
| 实测时间 | 2026-11-25 12:28–13:03 (Asia/Hong_Kong) |
| Node | `C:/Program Files/nodejs/node.exe` v24.14.0 |
| ffprobe / ffmpeg | 8.1.1-full_build-www.gyan.dev（`C:\Users\15056\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\`） |
| 成片 | `out/cineforge-demo-01/renders/cineforge-demo-01.mp4`（`hyperframes_version 0.9.88`、`encoder Lavf62.12.101`、20.000000s / 600f @30fps / 9:16） |
| 采样率基准 | 源文件 44100 Hz；成片音轨 48000 Hz；帧率 30fps（1f = 0.033333s；1f@48k = 1600 samples） |

**只读合规**：未修改 `scripts/`、`lib/`、`examples/`、`out/` 下任何文件；**未运行 render**（很慢，且被禁止）；未调用 git；未请求 sandbox 提权。所有 A/B 混音均在 Node 内存里用 ffmpeg `pipe:0/pipe:1` 完成，未落盘任何临时音频。`.local/` 下只新增本报告。

**方法与可信度**：峰值测量用「解码成 PCM 逐样本求绝对值最大」为主，`volumedetect` / `astats` 作幅度交叉验证，`ffmpeg -ar 48000` 重采样作时间交叉验证，归一化互相关（NCC）作端到端验证。所有数字均为本机实测；做不到的（主观试听、两版真实渲染）在 §6/§8 如实说明，不编造。

---

## 1. 资产清单与 ffprobe 全量实测

### 1.1 目录全部文件（含非音频）

`assets/audio/sfx/`（7 个文件，其中 6 个 MP3）

| 文件 | 字节 |
|---|---|
| `ATTRIBUTION.md` | 1743 |
| `click-camera.mp3` | 14406 |
| `impact-cine.mp3` | 115904 |
| `swoosh-quick.mp3` | 27247 |
| `transition-snap.mp3` | 19051 |
| `transition-soft.mp3` | 41082 |
| `whoosh-fast.mp3` | 57624 |

`assets/audio/bgm/`（3 个文件，其中 2 个 MP3）

| 文件 | 字节 |
|---|---|
| `ATTRIBUTION.md` | 1184 |
| `cineforge-bgm-16s.mp3` | 257088 |
| `cineforge-bgm-20s.mp3` | 321036 |

> 附带发现：`out/cineforge-demo-01/assets/audio/` 中 6 个 SFX 与 `cineforge-bgm-20s.mp3`、两份 ATTRIBUTION.md 的 SHA256 与源文件逐一相同（即编译器是原样拷贝、未重新编码）；`cineforge-bgm-16s.mp3` 未被拷贝进产物（该版本不参与本片）。因此**源文件的 priming / 峰值测量可直接代表产物中的素材**。

### 1.2 逐文件 ffprobe 实测（`format.duration` 与 `stream.duration` 一致）

| 文件 | 精确时长 s | 采样率 | 编码 | 声道 / sample_fmt | stream bit_rate | encoder tag | start_time | initial_padding | 首包 Skip Samples | discard_padding |
|---|---|---|---|---|---|---|---|---|---|---|
| `sfx/click-camera.mp3` | **0.350522** | 44100 | mp3 (`mp4a.40.34`) | 2 / fltp | 294123 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `sfx/impact-cine.mp3` | **4.063107** | 44100 | mp3 | 2 / fltp | 218097 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `sfx/swoosh-quick.mp3` | **0.781383** | 44100 | mp3 | 2 / fltp | 269174 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `sfx/transition-snap.mp3` | **0.573968** | 44100 | mp3 | 2 / fltp | 253668 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `sfx/transition-soft.mp3` | **1.274739** | 44100 | mp3 | 2 / fltp | 251627 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `sfx/whoosh-fast.mp3` | **1.756712** | 44100 | mp3 | 2 / fltp | 255759 | LAME3.99r | 0.025057 | 0 | **1105** | 0 |
| `bgm/cineforge-bgm-16s.mp3` | **16.000000** | 44100 | mp3 | 2 / fltp | 128000 | Lavc62.28 / Lavf62.12.101 | 0.025057 | 0 | **1105** | 0 |
| `bgm/cineforge-bgm-20s.mp3` | **20.000000** | 44100 | mp3 | 2 / fltp | 128000 | Lavc62.28 / Lavf62.12.101 | 0.025057 | 0 | **1105** | 0 |

补充字段：

- 全部 8 个 MP3 的 `time_base = 1/14112000`、`start_pts = 353600`、`codec_tag_string = [0][0][0][0]`、`bits_per_sample = 0`、`side_data_list` 含 `Replay Gain`（BGM 两份无）。
- 全部 8 个 MP3 的**首个 packet** 都带 `Skip Samples: skip_samples=1105, discard_padding=0, skip_reason=0`；首个 `frame` 为 `pts=353600 (0.025057s), nb_samples=47`，第二个 `frame` 为 `pts=368640 (0.026122s), nb_samples=1152`。因为 `0.025057 × 44100 = 1105` 且 `1152 − 1105 = 47` —— 这证明 **ffmpeg 解码时已按 1105 samples 跳过了 LAME 的编码垫头**，解码出的 PCM 第 0 个样本就是真实音频起点。
- **源文件的 MP3 priming（encoder delay）= 1105 samples @44100 = 0.025057 s = 0.7517 f @30fps**，`discard_padding = 0`（尾部无补齐）。这是解码器已补偿的量，**不要再在 `from` 里重复扣**。
- `impact-cine.mp3` 另有 ID3/iTunes 标签：`TSS = Logic Pro 9.1.8`、`iTunSMPB = " 00000000 00000210 00000AE0 000000000002B110 ..."`（`0x210 = 528`、`0xAE0 = 2784`）。该 gapless 标签与首包 `skip_samples = 1105` 不一致；**以 packet side data 为准**（ffmpeg 实际按 1105 裁剪）。
- `scripts/compile-hf.mjs` L23–30 的 `SFX_DUR` 常量（`click 0.351 / transition-soft 1.275 / transition-snap 0.574 / swoosh-quick 0.781 / whoosh-fast 1.757 / impact-cine 4.063`）与上表精确值一一对应（四舍五入到 3 位），**常量本身无漂移**；问题不在时长测量，而在裁切策略（§5.1）。

### 1.3 可复现命令（PowerShell / ffprobe）

```powershell
$base = 'D:/01_HJ_Work/00_Person/04_Project/11_Creation/03_Video/02_MyWork/02_cineforge/assets/audio'
Get-ChildItem -LiteralPath "$base/sfx","$base/bgm" -File -Filter *.mp3 | ForEach-Object {
  ffprobe -v error -show_format -show_streams -of json $_.FullName
  ffprobe -v error -select_streams a:0 -read_intervals '%+#3' -show_packets `
    -show_entries 'packet=pts,pts_time,dts_time,duration_time,size,flags,side_data_list' -of json $_.FullName
  ffprobe -v error -select_streams a:0 -read_intervals '%+#2' -show_frames `
    -show_entries 'frame=pts,pts_time,nb_samples,side_data_list' -of json $_.FullName
}
```

---

## 2. S5：输出音轨 AAC priming 偏移实测

### 2.1 判例原文（`knowledge/aesthetic-rules.json` L168–173）

> S5「音画对齐补两项偏移：输出音轨偏移逐渲染管线实测统一扣，音源峰值滞后逐文件量」：渲出成片整条音轨相对视频有固定滞后，根因在输出编码/封装链路（**AAC encoder priming，48kHz 典型 2048 samples ≈ 1.28f@30fps**；Remotion 跟踪 `remotion-dev/remotion#7099`），不是 `<Audio>`/`Sequence.from` 的行为——**按渲染管线（版本 + codec + 采样率 + 容器）实测记档**（渲出成片抽音轨，拿 2–3 个尖锐 SFX 原文件做归一化交叉相关，残差一致才算量准），补偿在渲染层的 `from` 计算式统一扣除，不逐条改帧号；音源自身的峰值滞后逐文件量。统一公式 `from = 目标峰值帧 − 峰值滞后 − 输出偏移`，边界（截断型音效窗口不加长、**片头 2f 内无法全补**）见 sound-design §4.6。
> precedent：AiflPromo 实测 click 滞后 2032 samples、impact 2066 samples（≈1.27–1.29f）；promo-ink 时代实测过 4f；**常数不可跨管线搬运**。

### 2.2 成片音轨 ffprobe（`out/cineforge-demo-01/renders/cineforge-demo-01.mp4`）

```text
codec_name = aac, profile = LC, mime_codec_string = mp4a.40.2
sample_rate = 48000, channels = 2, channel_layout = stereo, sample_fmt = fltp
time_base = 1/48000, start_pts = 0, start_time = 0.000000
duration_ts = 960000, duration = 20.000000, nb_frames = 939, bit_rate = 200930
initial_padding = 0
format.duration = 20.000000, tags.encoder = Lavf62.12.101,
tags.hyperframes_version = 0.9.88, tags.hyperframes_renderer = hyperframes
```

### 2.3 首包 side data 与 MP4 edit list（关键证据）

```text
packet[0]: pts = -1024, pts_time = -0.021333, dts_time = -0.021333,
           duration_time = 0.021333, flags = "KD_",
           side_data_list: Skip Samples { skip_samples = 1024, discard_padding = 0 }
packet[1]: pts = 0,      pts_time =  0.000000
packet[2]: pts = 1024,   pts_time =  0.021333
```

`ffprobe -v trace` 的 `elst` 解析：

```text
type:'elst' parent:'edts' sz: 28 8 28
Processing st: 0, edit list 0 - media time: 0,    duration: 307200   (视频)
Processing st: 1, edit list 0 - media time: 1024, duration: 960000   (音频)
demuxer injecting skip 1024 / discard 0
[aac] skip 1024 / discard 0 samples due to side data
```

**结论 1（本管线的 encoder delay 指纹）**：本片用的是 **FFmpeg native AAC encoder，1024 samples 的 priming**，不是判例里 2048 samples 的那套编码器。

- 实测值 `1024 / 48000 = 0.021333 s = 0.640 f @30fps`（`1024 samples = 1 AAC frame`）。
- 判例理论值 `2048 / 48000 = 0.042667 s = 1.280 f @30fps` —— **本管线不适用，不可照搬**。
- 音频 `elst` 的 `media_time = 1024` + `duration = 960000 (=20s)` 明确声明从媒体第 1024 个 sample 开始播放，即 **封装层已把这 1024 samples 的垫头裁掉**，播放起点与视频 t=0 对齐。

### 2.4 脉冲往返实测（独立复验 encoder delay）

在内存里造 1s / 48kHz / 单声道 PCM，只在 sample 0 放幅度 1.0 的脉冲，`ffmpeg -c:a aac -f adts` 编码后再解码回 PCM：

```text
AAC (ADTS) 编码→解码：解码后峰值出现在 sample 1024 = 0.021333 s = 0.640 f，amp 0.7139
AAC-in-MP4 编码→封装→解封装（elst 生效）：解码后峰值出现在 sample 0 = 0.000000 s = 0.000 f
```

两条路径的差 `1024 samples` 就是 `elst` 补偿量；**经 MP4 容器后，听感上的输出偏移为 0**。

### 2.5 归一化互相关（判例要求的「2–3 个尖锐 SFX 残差一致」）

方法：把**真实渲出的 MP4** 抽成 48kHz 单声道 PCM；对每个 SFX 取其源 PCM 峰值附近 ±40ms（共 80ms）作模板，在成片混音里按 `data-start` 预期位置 ±40ms 搜索归一化互相关最大值，记录最佳 lag = 端到端残差。

```text
file               | at_s | expected_peak_s | residual_s | residual_f@30 | NCC
impact-cine.mp3    |  0   |  0.5511         | +0.000000  |  0.000        | 0.9979
whoosh-fast.mp3    |  3   |  3.7128         | +0.000000  |  0.000        | 0.9793
transition-snap.mp3|  6   |  6.1174         | +0.000000  |  0.000        | 0.9235
click-camera.mp3   | 10   | 10.1945         | +0.000000  |  0.000        | 0.9738
swoosh-quick.mp3   | 14   | 14.2959         | +0.000000  |  0.000        | 0.9986
impact-cine.mp3    | 17   | 17.5511         | +0.000000  |  0.000        | 0.9989
mean residual = 0.000000 s = 0.000 f ; max |residual| = 0.000000 s
```

6 条全部残差一致（0.000s），NCC 0.9235–0.9989，满足判例「残差一致才算量准」。独立旁证：成片前 1.5s 的全域峰值落在 `0.551208 s = 16.54 f`，与 `impact-cine` 源峰值 `0.551111 s` 相差 `0.000097 s`（一个 48k 采样点的量化误差），即 **≈ 0.00 f**。

### 2.6 S5 结论与建议常数（要有依据）

| 量 | 实测值 | 用途 |
|---|---|---|
| 理论 2048 samples（判例典型） | 0.042667 s / **1.28 f** | 仅作对照，**不适用于本管线** |
| 本管线 AAC encoder priming | **1024 samples @48k = 0.021333 s / 0.64 f** | 记档为「管线指纹」 |
| MP4 `elst` 补偿 | media_time = 1024 | 封装层已扣除 |
| **端到端输出偏移（`from` 里该减的量）** | **0.000 s = 0.00 f** | **建议取 0** |

> **建议输出偏移常数 = 0.000 s（0.00 f @30fps）**，限定于本管线：`hyperframes 0.9.88 / FFmpeg native AAC-LC / 48000 Hz / MP4 (Lavf62.12.101) / 30fps`。
> 依据：§2.3 的 `elst media_time=1024` + §2.4 脉冲往返 + §2.5 六条 SFX 互相关残差全为 0.000s。
> **风险控制（不可跨管线搬运）**：若输出改为不带 edit list 的容器（裸 `.aac`/ADTS、TS、或浏览器 MediaRecorder 路径），补偿会失效，此时 `from` 必须改扣 `1024/48000 = 0.021333 s (0.64 f)`；若换了 2048-sample 的编码器（判例的 Remotion 路径），才扣 `0.042667 s (1.28 f)`。**每次换 codec / 采样率 / 容器 / 渲染器版本，都要重跑 §2.5 的互相关并重记档**。补偿写在渲染层 `from` 计算式里统一扣，不要逐条改帧号。

---

## 3. 峰值滞后（`peak_offset_s`）实测

### 3.1 可复现方法

**主方法（本次采用，逐样本精确）**：`ffmpeg` 把 MP3 解码成 `f32le` PCM 经 `pipe:1` 读入 Node 内存，遍历所有样本求 `|x[i]|` 最大值的位置 `pi`，`peak_offset_s = pi / 44100`。ffmpeg 解码时已应用首包 `Skip Samples=1105`（§1.2），故 `pi=0` 对应 `<audio>` 播放到的第一个真实样本，**与 HyperFrames 的 `data-start` 时间轴口径一致**。

```js
// peak-lab.mjs —— 用 C:/Program Files/nodejs/node.exe peak-lab.mjs <file.mp3>
import { spawnSync } from "node:child_process";
const file = process.argv[2];
const r = spawnSync("ffmpeg", ["-v","error","-i",file,"-map","0:a:0","-ac","1","-f","f32le","pipe:1"],
                    { maxBuffer: 200*1024*1024 });
if (r.status !== 0) throw new Error(String(r.stderr));
const n = Math.floor(r.stdout.length/4);
let peak = 0, pi = 0;
for (let i=0;i<n;i++){ const a=Math.abs(r.stdout.readFloatLE(i*4)); if(a>peak){peak=a;pi=i;} }
console.log(JSON.stringify({
  file, sample_rate: 44100, peak_sample: pi,
  peak_offset_s: +(pi/44100).toFixed(4),
  peak_frames_30fps: +(pi/44100*30).toFixed(2),
  peak_amp_dbfs: +(20*Math.log10(peak)).toFixed(3)
}, null, 2));
```

**交叉验证命令**（三条独立通路，本次全部跑过且互相吻合）：

```bash
# (a) 幅度：volumedetect / astats（确认峰值样本不是解码异常）
ffmpeg -hide_banner -i <file.mp3> -map 0:a:0 -af volumedetect -f null -
ffmpeg -hide_banner -i <file.mp3> -map 0:a:0 -af astats=metadata=1:reset=0 -f null -

# (b) 时间：重采样到 48kHz 后再求峰值，验证与采样率无关
ffmpeg -v error -i <file.mp3> -map 0:a:0 -ac 1 -ar 48000 -f f32le pipe:1

# (c) 响度包络：10ms 窗 / 1ms hop 的 RMS 能量峰（区分「瞬时尖峰」与「听觉重心」）
#     静音起点：silencedetect=noise=-60dB:d=0.01
```

> 说明：`astats` 只给 `Peak level dB` / `RMS level dB` / `Crest factor`，**不直接给峰值时间位置**；`volumedetect` 同理。因此位置必须用 PCM 逐样本（或 `astats=metadata=1` 输出的 `lavfi.astats.*.Peak_level` 逐帧元数据配合 `ametadata=print`）求。本次以 PCM 逐样本为准，幅度以 `volumedetect`/`astats` 复核。

### 3.2 实测结果（**本报告核心数字**）

| SFX 文件 | 峰值样本 @44100 | `peak_offset_s` (4 位) | **帧数 @30fps (2 位)** | 48k 重采样复核 s | 10ms-RMS 能量峰 s | 首个可闻样本 s | peak dBFS (PCM) | volumedetect max | astats Peak level dB |
|---|---|---|---|---|---|---|---|---|---|
| `impact-cine.mp3` | 24304 | **0.5511** | **16.53** | 0.5511 | 0.6326 | 0.0726 | −0.375 | −0.4 dB | −0.375447 |
| `click-camera.mp3` | 8579 | **0.1945** | **5.84** | 0.1945 | 0.1936 | 0.0839 | −5.706 | −5.7 dB | −5.705928 |
| `whoosh-fast.mp3` | 31436 | **0.7128** | **21.39** | 0.7128 | 0.7244 | 0.0000 | −1.270 | −1.3 dB | −1.893966 |
| `transition-snap.mp3` | 5176 | **0.1174** | **3.52** | 0.1174 | 0.1138 | 0.0255 | −4.028 | −4.0 dB | −4.187684 |
| `swoosh-quick.mp3` | 13051 | **0.2959** | **8.88** | 0.2960 | 0.3362 | 0.0368 | −0.090 | −0.1 dB | −0.089785 |
| `transition-soft.mp3` | 19165 | **0.4346** | **13.04** | 0.4346 | 0.4310 | 0.0789 | −0.935 | −0.9 dB | −0.934763 |

BGM（连续床，峰值不用于钉帧，仅记档）：`cineforge-bgm-20s.mp3` 峰值样本 671724 → `15.2318 s = 456.96 f`；`cineforge-bgm-16s.mp3` 同为 `15.2318 s`（16s 版本是 20s 版本的前 16s，峰值仍在同一位置）。

**判读**：6 条 SFX 的峰值滞后从 `3.52 f` 到 `21.39 f` 不等，**没有一条峰值在文件头**。若按 `data-start = 镜头起点` 直接铺（当前 `examples/demo-project.json` 的做法），实际最重一击会晚 `0.1174–0.7128 s`（3.5–21.4 帧），远超 QA SKILL L36 的「卡点误差 ≤3f」门槛。这正是 S5 要求逐文件量、并在 `from` 统一扣除的原因。

### 3.3 `impact-cine.mp3` 尾部衰减（为 §5 的裁切提供依据）

20ms 窗 RMS 最后一次高于阈值的时刻：

| 阈值 | 最后超过时刻 |
|---|---|
| −20 dBFS | 0.9200 s |
| −30 dBFS | 1.1800 s |
| −40 dBFS | 1.5900 s |
| −50 dBFS | 1.7800 s |
| −60 dBFS | 2.3100 s |

文件总长 4.063107 s。**2.310 s 之后整段都在 −60 dBFS 以下**，因此把 s01 的播放窗裁到 2.951 s（甚至 2.4 s）在听感上几乎无损——这是「长样本按画面段落裁到等长」可行的物理依据。

---

## 4. `from = 目标峰值帧 − 峰值滞后 − 输出偏移`：公式与常数

### 4.1 公式（秒域 / 帧域）

```text
【帧域】  from_frames = 目标峰值帧 − 峰值滞后帧 − 输出偏移帧
          其中 峰值滞后帧 = peak_offset_s × 30
                输出偏移帧 = 输出偏移_s × 30 = 0.00（本管线，见 §2.6）

【秒域】  from_s      = from_frames / 30
                     = 目标峰值帧/30 − peak_offset_s − 输出偏移_s

【裁切】  data-duration = min( 源时长, 本镜 end_s − from_s, 全片 20s − from_s )
          硬约束：from_s ≥ 本镜 start_s  且  from_s + data-duration ≤ 本镜 end_s
```

`from` 即 `<audio data-start>`（HyperFrames 的**时间轴位置**，不是源文件内的 seek 偏移）。把 clip 提前 `peak_offset_s` 放置，其峰值才会落在 `目标峰值帧`。

### 4.2 建议常数

| 常数 | 建议值 | 依据 |
|---|---|---|
| `输出偏移_s` | **0.000 s（0.00 f）** | §2.3/§2.4/§2.5；`elst media_time=1024` 已补偿，6 条 SFX 互相关残差 0.000s |
| `输出偏移_s`（无 edit list 的容器） | 0.021333 s（0.64 f） | `1024/48000`，§2.4 脉冲往返 |
| `峰值滞后_s` | **逐文件取 §3.2 表**，不设统一常数 | 6 条离散在 0.1174–0.7128 s |
| 帧率 | 30 fps | `examples/demo-project.json` L14 |
| 补偿位置 | **渲染层 `from` 计算式统一扣** | 判例 S5 原文；不逐条手改帧号 |

### 4.3 边界（判例点名，必须写进工程说明）

1. **片头无法全补**：若 `目标峰值帧 = f0`（`hit_list[0]=0`），则 `from_frames = 0 − 16.53 − 0 = −16.53 f`（`−0.5511 s`），`data-start` 为负，HyperFrames 不接受。最早可实现的峰值是 `f16.53`（clip 贴着 t=0 放）。要真正把峰值钉在 f0，必须**改源**：把 `impact-cine.mp3` 头部 0.5511s 裁掉生成派生资产，使 `peak_offset_s → 0`（`截断型音效窗口不加长`）：
   ```bash
   ffmpeg -i impact-cine.mp3 -af "atrim=start=0.551111,asetpts=N/SR/TB,afade=t=in:st=0:d=0.01" -c:a libmp3lame -b:a 192k impact-cine-peakhead.mp3
   ```
   裁完须重新 ffprobe / 重新测 `peak_offset_s` 并重记档；`SFX_DUR` 也要同步改。
2. **镜内最早峰值**：受 `from_s ≥ start_s` 限制，任何镜内最早可钉的峰值 = `start_s + peak_offset_s`。s02 用 `whoosh-fast`（0.7128s）时最早只能到 `f111.38`，因此下表 s02 取 `f112`。
3. **不得越界**：`data-duration` 必须按**镜头边界**裁（见 §5.1），当前 `buildAudio()` 只按全片 20s 裁，这是 S4 缺陷的根因。

---

## 5. 逐镜拟音映射表（S4）

### 5.1 现有 `buildAudio()` 逻辑与缺陷定位

`scripts/compile-hf.mjs` L193–214：

```js
const srcDur = SFX_DUR[x.file];                                    // L203
const at = Number(x.at);                                           // L205
const dur = Number(Math.min(srcDur, Math.max(0, total_s - at)).toFixed(3));  // L208 ★
parts.push(/* <audio data-start=at data-duration=dur data-volume=vol ...> */); // L210
used.push({ role:"sfx", file:x.file, at, duration_s:dur, source_duration_s:srcDur, clamped: dur < srcDur }); // L211
```

- **L208 只对 `total_s - at`（全片尾）取 min，不知道镜头边界**。所以 `at=0` 的 `impact-cine` 得 `dur = 4.063`（`clamped:false`），越过 `s01` 的 3s 切点 1.063s 拖进 s02；只有 `at=17` 那条被 20s 片尾裁成 3.0s（`clamped:true`）。`manifest.json` L156–163 / `index.html` L148 的 `data-start="0" data-duration="4.063"` 即证据。
- 分镜源 `audio.sfx[]`（`demo-project.json` L211–242）**只有 `file/at/volume`**，没有 `duration_s` / `end_s`，也没有逐条「对应画面动作」注释；6 条 `at` 全等于 6 镜起点（`hit_list[0,3,6,10,14,17]`），**完全没有扣峰值滞后**。
- 建议（本次不实施，仅书面结论）：分镜 SFX 项增加 `duration_s`（或 `end_s`）与 `action` 字段；`buildAudio()` 的 L208 改为按镜头边界裁：`dur = min(srcDur, shotEnd(x.at) − at, total_s − at)`，并把 `at` 由「镜头起点」改为「按 §4.1 算出的 `from_s`」。

### 5.2 `impact-cine` 4.063s 越过 s01 3s 边界 —— 处置方案

**采纳方案（最小改动、不动源文件、不新增资产）**：

```text
s01: data-start = 0.049 s (= f1.47)   ← from = 0.600 − 0.5511 − 0
     data-duration = 2.951 s          ← min(4.063, 3.000 − 0.049, 20 − 0.049)
     结束 = 3.000 s，恰好停在 s01/s02 切点，0 越界
     峰值落点 = 0.049 + 0.5511 = 0.600 s = f18.00（字标 crash-zoom 冲击）
     源尾被裁掉 4.063 − 2.951 = 1.112 s；§3.3 证明 2.310 s 后已低于 −60 dBFS，听感无损
     volume = 0.85（保持现值）
```

三条替代路径（按代价排序）：

| 方案 | 做法 | 代价 / 评价 |
|---|---|---|
| **A（推荐）** | 只改 `data-start=0.049` + `data-duration=2.951`（配合 §5.1 的镜头边界裁切） | 零新资产，越界归零，峰值钉在 f18 |
| B | 峰值要落在「字标落定」f89（2.967s）：`from = 2.967 − 0.5511 = 2.416s`，但 clip 会到 `2.416+4.063=6.479s`，**必然越界**；须先按 §3.3 把源裁成 `2.9s` 派生资产并把峰值移到尾部 | 需新增资产、改 `SFX_DUR`，改动大 |
| C | 整段换成短音效（如 `transition-snap` 0.574s） | 失去「电影感 deep impact」，与 `energy:peak` 的 s06 也不呼应，不推荐 |

> 同样地，`s06`（`at=17`，`impact-cine` 4.063s）现被 20s 片尾裁成 3.0s，虽未越界但峰值落在 `17.5511s (f526.53)` 且未扣滞后；下表改为 `from=17.116 / dur=2.884 / end=20.000`，峰值钉在 `f530`。

### 5.3 逐镜拟音映射表（`output offset = 0.000 s`；所有条目 `from ≥ start` 且 `end ≤ shot end`，逐行已校验 OK）

镜头边界来自 `demo-project.json` L34–193 与 QA 报告 L34：s01 f0–f89 / 0–3s，s02 f90–f179 / 3–6s，s03 f180–f299 / 6–10s，s04 f300–f419 / 10–14s，s05 f420–f509 / 14–17s，s06 f510–f599 / 17–20s，全片 600f / 20s @30fps / 9:16。

| # | 镜 / 帧 / 秒 | 音效文件 | 目标峰值帧 | target_s | peak_s | 输出偏移_s | **`at`=`from_s`** | from_f | **`data-duration`** | end_s | vol | 越界 | 画面对应动作（逐条拟音注释） |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | s01 f0–f89 / 0–3 | `impact-cine.mp3` | f18 | 0.6000 | 0.5511 | 0.000 | **0.049** | 1.47 | **2.951** | 3.000 | 0.85 | OK | 「影铸 CineForge」字标 crash-zoom 落定重击；裁到 3.000s 不拖进 s02 |
| 2 | s02 f90–f179 / 3–6 | `whoosh-fast.mp3` | f112 | 3.7333 | 0.7128 | 0.000 | **3.021** | 90.63 | **1.757** | 4.778 | 0.70 | OK | 「普通模型，也能有导演级设计感」标语 slide-up 推入的风声；因滞后 0.7128s，f112 已是镜内最早可钉点 |
| 3a | s03 f180–f299 / 6–10 | `transition-snap.mp3` | f186 | 6.2000 | 0.1174 | 0.000 | **6.083** | 182.49 | **0.574** | 6.657 | 0.80 | OK | 三张 mini-card 第 1 张「运镜 CAMERA·10」落定 snap |
| 3b | s03 | `transition-snap.mp3` | f195 | 6.5000 | 0.1174 | 0.000 | **6.383** | 191.49 | **0.574** | 6.957 | 0.72 | OK | 第 2 张「字排 TYPOGRAPHY·22」落定；与 3a 间隔 0.3s |
| 3c | s03 | `transition-snap.mp3` | f201 | 6.7000 | 0.1174 | 0.000 | **6.583** | 197.49 | **0.574** | 7.157 | 0.64 | OK | 第 3 张「转场 TRANSITION·15」落定；间隔收窄到 0.2s + 音量阶梯递减 = 越来越快/发牌式 |
| 4a | s04 f300–f419 / 10–14 | `click-camera.mp3` | f306 | 10.2000 | 0.1945 | 0.000 | **10.005** | 300.15 | **0.351** | 10.356 | 0.85 | OK | 确认门清单第 1 行「文案已定稿」逐条勾选的快门 click |
| 4b | s04 | `click-camera.mp3` | f318 | 10.6000 | 0.1945 | 0.000 | **10.405** | 312.15 | **0.351** | 10.756 | 0.85 | OK | 第 2 行「分镜已排布」勾选 click |
| 4c | s04 | `click-camera.mp3` | f330 | 11.0000 | 0.1945 | 0.000 | **10.806** | 324.18 | **0.351** | 11.157 | 0.55 | OK | 第 3 行「动效待你确认」停在待确认态，click 更轻、不闭合 |
| 5a | s05 f420–f509 / 14–17 | `transition-soft.mp3` | f435 | 14.5000 | 0.4346 | 0.000 | **14.065** | 421.95 | **1.275** | 15.340 | 0.60 | OK | 「150 个动效预览」数字滚动/计数爬升的柔和气流底（**不用通用 swoosh-quick**） |
| 5b | s05 | `click-camera.mp3` | f444 | 14.8000 | 0.1945 | 0.000 | **14.606** | 438.18 | **0.351** | 14.957 | 0.45 | OK | 计数器跳数的一次轻 tick（可懂的「数在动」） |
| 5c | s05 | `click-camera.mp3` | f456 | 15.2000 | 0.1945 | 0.000 | **15.005** | 450.15 | **0.351** | 15.356 | 0.85 | OK | **「150」数字落定锁死**的确定性机械 click —— 替代原 `swoosh-quick`，是「停住」而不是「扫过」 |
| 6 | s06 f510–f599 / 17–20 | `impact-cine.mp3` | f530 | 17.6667 | 0.5511 | 0.000 | **17.116** | 513.48 | **2.884** | 20.000 | 0.90 | OK | 「CineForge · 影铸」品牌字标锁定 + 进度条推进的收尾重击；`energy:peak` 的听觉峰值 |

**表中数字的算法**（逐行可复算）：`at = 目标峰值帧/30 − peak_offset_s − 0.000`；`data-duration = min(源时长, 镜末 − at, 20 − at)`；`end = at + data-duration`。例如 s01：`18/30 − 0.5511 = 0.0489 → 0.049`，`min(4.063, 3−0.049, 20−0.049) = 2.951`，`0.049+2.951 = 3.000` ✓。

**「数字落定不用通用 swoosh-quick」的处理**：`swoosh-quick.mp3`（0.781s，峰值 0.2959s）是「快速小扫过」的通用转场音，语义与「计数停住」相反。新方案用三条专属拟音组合：`transition-soft`（滚动底）→ `click-camera` 轻 tick（跳数）→ `click-camera` 重 tick（150 落定锁死），并把「落定」放在 f456 而非镜首 f420。**`swoosh-quick.mp3` 在本片 6 镜里完全不使用**（保留在素材库供其他场景用）。`swoosh-quick` 的 `peak_offset_s = 0.2959 / 8.88f` 仍列入 §3.2 备查。

**音量建议口径**：`transition-snap` 三连 0.80→0.72→0.64（阶梯递减，避免三次同响掩盖错峰）；`click-camera` 三连 0.85/0.85/0.55（第三行 pending 更轻）；`s05` 0.60/0.45/0.85（末击最响，形成「落定」）；BGM 保持 `0.42`（`demo-project.json` L209）。所有 SFX 峰值本就 ≤ −0.1 dBFS（§3.2），叠加 BGM 后成片 True Peak = −1.2 dBFS（§7），无削波余量仍够。

> **诚实保留**：QA §2 的 R2/R3 已指出 `s03`「三卡依次落定」与 `s04`「清单逐条勾选」在**画面上仍未逐条动画**（`index.html` L164/L111 是整块 0.62s 滑入 / 静态文本）。上表的 3a–3c、4a–4c 是**声音侧的逐条拟音**；要做到真正音画同步，视觉侧也需按同样帧号错峰。这属于 §9 的 P1「收尾/开场整镜重做」与 P2 范畴，本报告不改源码。

### 5.4 NCC 复核建议

落地后按 §2.5 的方法，对新的 12 个 clip 各做一次「源峰值窗口 ↔ 成片」互相关，要求 `|residual| ≤ 3f`（QA SKILL L36）、且各条残差一致；这条同时验证 S5 与 S4 是否真的闭环。

---

## 6. 「带 BGM / 无 BGM 两版」验证：最小可复现步骤（命令级）

**现状**：`.hyperframes/render-outputs.json` 只有一条 `paths:["renders/cineforge-demo-01.mp4"]`（QA §5 L121），两版都未渲。`hyperframes` CLI 当前**不在 PATH**（`Get-Command hyperframes` 空），`npx` 在 `C:\Program Files\nodejs\npx.ps1`；下面命令需在能解析 `npx --yes hyperframes@0.9.88` 的环境里执行。**本次按硬约束未运行任何 render**，以下步骤是给 QA 所有者的执行清单。

`buildAudio()` L198 的判据是 `if (bgm && bgm.ref)`，因此**只要把分镜的 `audio.bgm.ref` 去掉（或 `audio.bgm = null`），编译器就不会产出 BGM `<audio>`**，不需要改编译器。为避免碰 `examples/`，把两份临时分镜放在 `.local/ab/`。

```powershell
$root = 'D:/01_HJ_Work/00_Person/04_Project/11_Creation/03_Video/02_MyWork/02_cineforge'
$node = 'C:/Program Files/nodejs/node.exe'
New-Item -ItemType Directory -Force "$root/.local/ab" | Out-Null

# (1) 生成两份临时分镜（只写 .local/，绝不改 examples/）
$sb = Get-Content "$root/examples/demo-project.json" -Raw | ConvertFrom-Json
$sb | ConvertTo-Json -Depth 30 | Set-Content "$root/.local/ab/demo-with-bgm.json" -Encoding utf8
$sb.audio.bgm = $null                       # 或 $sb.audio.PSObject.Properties.Remove('bgm')
$sb | ConvertTo-Json -Depth 30 | Set-Content "$root/.local/ab/demo-no-bgm.json" -Encoding utf8

# (2) 分别编译到独立 out 目录（不覆盖现有 out/cineforge-demo-01）
& $node "$root/scripts/compile-hf.mjs" --project "$root/.local/ab/demo-with-bgm.json" --out "$root/.local/ab/with-bgm"
& $node "$root/scripts/compile-hf.mjs" --project "$root/.local/ab/demo-no-bgm.json"  --out "$root/.local/ab/no-bgm"

# (3) 校验：with-bgm 应有 7 个 <audio>；no-bgm 应有 6 个且无 id="bgm"
Select-String -Path "$root/.local/ab/with-bgm/index.html","$root/.local/ab/no-bgm/index.html" -Pattern '<audio' | ForEach-Object { "$($_.Path): $($_.Line.Trim())" }

# (4) 分别渲染（两条，各自落到自己的 renders/；慢，故本次未执行）
Push-Location "$root/.local/ab/with-bgm"; npx --yes hyperframes@0.9.88 render ; Pop-Location
Push-Location "$root/.local/ab/no-bgm";  npx --yes hyperframes@0.9.88 render ; Pop-Location

# (5) 两版客观对照（逐版跑，见 §7）
foreach ($v in 'with-bgm','no-bgm') {
  $mp4 = "$root/.local/ab/$v/renders/$v.mp4"   # 实际文件名以 hyperframes 输出为准
  ffprobe -v error -select_streams a:0 -show_entries `
    'stream=codec_name,sample_rate,channels,duration,start_time,bit_rate:format=duration' -of json $mp4
  ffmpeg -hide_banner -nostats -i $mp4 -map 0:a:0 -af 'ebur128=peak=true' -f null -
  ffmpeg -hide_banner -nostats -i $mp4 -map 0:a:0 -af volumedetect -f null -
  ffmpeg -hide_banner -nostats -i $mp4 -map 0:a:0 -af 'silencedetect=noise=-45dB:d=0.3' -f null -
}
# QA SKILL L26/L60 指定的工具口径（如 CLI 可用）：
#   hyperframes audio <video> --json     → LUFS / truePeak / clipping
```

### 6.1 本次已做的**替代实测**（内存 amix，非真实渲染）

因禁止 render，我用 ffmpeg `filter_complex amix` 在内存里按 `demo-project.json` 的 7 条音轨（BGM 0.42、6 条 SFX 的 at/volume）重建 20s / 48k / 立体声混音，分别带/不带 BGM，再测客观指标。**该重建与真实成片高度吻合**：重建「带 BGM」得 `I = −19.4 LUFS / LRA 12.8 LU / TP −1.2 dBFS`，真实 `cineforge-demo-01.mp4` 得 `I = −19.4 LUFS / LRA 12.9 LU / TP −1.2 dBFS`。

| 指标（20s / 48k stereo） | 带 BGM（内存重建） | **真实渲出 MP4** | 无 BGM（内存重建） |
|---|---|---|---|
| `ebur128` Integrated I | −19.4 LUFS | **−19.4 LUFS** | −16.4 LUFS |
| `ebur128` LRA | 12.8 LU | **12.9 LU** | 16.2 LU |
| `ebur128` True Peak | −1.2 dBFS | **−1.2 dBFS** | −1.3 dBFS |
| `volumedetect` max / mean | −1.2 / −22.9 dBFS | — | −1.3 / −24.3 dBFS |
| `silencedetect(-45dB, ≥0.3s)` | 无静音段 | 无静音段 | **6 段，共 14.925 s = 74.6% 全片** |

无 BGM 版的 6 段静音（秒）：`1.779–3.064`、`3.757–6.052`、`6.272–10.105`、`10.241–14.060`、`14.691–17.163`、`18.780–20.000`。

> 注：无 BGM 版 `I = −16.4 LUFS` **反而更高**，这是 EBU R128 相对门控在稀疏瞬态上的效应（静音被门控剔除后只剩响的 SFX），**不代表它听起来更响**；恰因如此，必须配合 `silencedetect` 的 74.6% 静音占比一起判读。这一对数字本身就是一个很好的「两版差异」客观判据。

---

## 7. 试听闭环的客观替代指标

**先说边界**：客观指标**不能等价替代**「闭眼只听音轨 / 候选曲垫进成片试听」的主观判据（QA SKILL L26、L36、L60；`aesthetic-rules` S1）。音色是否像产品发布会而非游戏、BGM 是否压住 SFX、卡点是否「读得出」——这些仍需至少留一次人工试听记录。客观指标的价值是**可回归、可量化、防退化**，把「已测量未试听」升级成「已测量 + 有客观判据 + 待人工确认」，而不是冒充已试听。

| 维度 | 命令 / 判据 | 本片实测值 | 建议阈值 |
|---|---|---|---|
| 综合响度 | `ffmpeg -af ebur128=peak=true` → `I:` | 成片 **−19.4 LUFS** | 社交短片 −16 ~ −14 LUFS（QA SKILL L26 已指出 −19.4 偏安静，需 `loudnorm` 或提 BGM 增益） |
| 响度动态 | `ebur128` → `LRA:` | 成片 **12.9 LU**（hi −17.2 / lo −30.1） | 短片 6–12 LU 更稳；>15 LU 说明段落起伏过大 |
| 真峰值 / 削波 | `ebur128` → `Peak:`；`volumedetect` → `max_volume` | **−1.2 dBFS**；BGM 源 −0.1、`swoosh-quick` −0.1、`impact-cine` −0.4 | ≤ −1 dBTP；`max_volume ≥ 0 dB` 或 `astats Peak level dB > 0` 判削波（本批 8 个文件全部无削波） |
| 幅度统计 | `ffmpeg -af astats=metadata=1:reset=0` | `impact-cine` Peak −0.375 dB / RMS −20.109 dB / Crest 9.698 / `Number of NaNs/Infs = 0` | 无 NaN/Inf、Crest 合理即解码健康 |
| 静音 / 音轨存在性 | `ffmpeg -af silencedetect=noise=-45dB:d=0.3` | 成片**无** ≥0.3s 静音；无 BGM 版 **14.925 s / 74.6%** | 带 BGM 版应 0 段长静音；无 BGM 版的长静音是预期差异证据 |
| 卡点误差 | 归一化互相关残差（§2.5） | **0.000 f**（6/6 条） | ≤ 3f（QA SKILL L36） |
| 音轨结构 | `ffprobe -select_streams a:0 -show_streams` | AAC-LC / 48000 / stereo / `duration 20.000000` / `start_time 0` | 时长恒等 20s、起点 0、无 `initial_padding` 残留 |
| 官方工具 | `hyperframes audio <video> --json` | 本次 CLI 不可用（见 §6） | 补齐 LUFS / truePeak / clipping 三件套并写进 `out/qa/` |

**最小闭环清单（交给 QA 所有者）**：① 按 §6 渲两版 → ② 两版各跑一遍 `ebur128` + `volumedetect` + `silencedetect` + `ffprobe` 并落盘 `.local/ab/*.txt` → ③ 按 §5.4 对 12 个 clip 做 NCC 残差复核 → ④ 更新 `.hyperframes/render-outputs.json` 为两条路径 → ⑤ 更新 `out/qa/cineforge-demo-01.qa.md`：把 `verify.json` L155 过期的 `film_silent` note 改掉，写明「已测量（数字见本报告）+ 已渲两版 + S5 偏移实测 0.000s / priming 1024 samples + 待人工试听」→ ⑥ 人工闭眼试听一次并留一句结论。**⑥ 是唯一不能用指标替代的一步，必须如实保留为待办。**

---

## 8. 如实说明：做不到的与未做的

1. **未试听**：本次没有任何主观听感结论；§7 给的是客观替代指标与阈值，不冒充听感。
2. **未渲两版**：硬约束禁止 render，且 `hyperframes` CLI 不在 PATH。§6.1 的数字来自**内存 ffmpeg amix 重建**，不是两次真实渲染；重建与真实成片在 `I/LRA/TP` 上吻合（−19.4 / 12.8–12.9 / −1.2），但**不能当作「两版已渲出」的证据**。§6 给出命令级步骤供补做。
3. **`astats` 不直接给峰值时间位置**：`Peak level pos` 字段在本机 FFmpeg 8.1.1 的 `astats` 文本输出里不存在（本次实测该正则无命中）；故峰值位置一律以 PCM 逐样本为准，`astats` 只作幅度复核。
4. **判例的 2048 samples / 1.28f 未在本管线复现**：本管线是 1024 samples / 0.64f 且被 `elst` 补偿为净 0。这是实测差异，不是测量失败；已按判例「常数不可跨管线搬运」记档。
5. **未改任何源码/模板/分镜/产物**：§5.1 的 `buildAudio()` 改法、§5.3 的映射表、§4.3 的派生资产命令都只是书面建议；`examples/demo-project.json`、`scripts/compile-hf.mjs`、`out/` 全部保持原状。
6. **画面侧逐条动画未纳入**：`s03` 三卡 / `s04` 三行在 `index.html` 里仍是整块入场/静态文本（QA §2 R2/R3 保留项），声音侧逐条拟音要生效需视觉侧同步错峰，属另一条 P1。

---

## 附录 A：本报告全部可复现命令速查

```bash
# A1 全量 ffprobe（§1.3）
ffprobe -v error -show_format -show_streams -of json <file.mp3>
ffprobe -v error -select_streams a:0 -read_intervals '%+#3' -show_packets \
  -show_entries 'packet=pts,pts_time,dts_time,duration_time,size,flags,side_data_list' -of json <file.mp3>

# A2 成片 AAC priming（§2.2/§2.3）
ffprobe -v error -select_streams a:0 -show_streams -show_format -of json out/cineforge-demo-01/renders/cineforge-demo-01.mp4
ffprobe -v error -select_streams a:0 -read_intervals '%+#4' -show_packets \
  -show_entries 'packet=pts,pts_time,dts_time,duration_time,size,flags,side_data_list' -of json <mp4>
ffprobe -v trace -i <mp4> -show_entries format=duration -of csv 2>&1 | grep -E "elst|media time|skip"

# A3 脉冲往返测 encoder delay（§2.4，Node 内存版，见正文脚本）
#   ffmpeg -f f32le -ar 48000 -ac 1 -i pipe:0 -c:a aac -b:a 128k -f adts pipe:1
#   ffmpeg -f aac -i pipe:0 -f f32le pipe:1

# A4 峰值滞后（§3.1）
"C:/Program Files/nodejs/node.exe" peak-lab.mjs <file.mp3>
ffmpeg -hide_banner -i <file.mp3> -map 0:a:0 -af volumedetect -f null -
ffmpeg -hide_banner -i <file.mp3> -map 0:a:0 -af astats=metadata=1:reset=0 -f null -
ffmpeg -v error -i <file.mp3> -map 0:a:0 -ac 1 -ar 48000 -f f32le pipe:1

# A5 impact-cine 尾部衰减
#   解码 PCM 后 20ms 窗 / 10ms hop 求最后一次 RMS > -20/-30/-40/-50/-60 dBFS

# A6 归一化互相关（§2.5 / §5.4）
#   成片抽 48k mono PCM；源峰值 ±40ms 作模板；预期位置 ±40ms 搜索 NCC 最大 lag

# A7 客观试听指标（§7）
ffmpeg -hide_banner -nostats -i <mp4> -map 0:a:0 -af 'ebur128=peak=true' -f null -
ffmpeg -hide_banner -nostats -i <mp4> -map 0:a:0 -af volumedetect -f null -
ffmpeg -hide_banner -nostats -i <mp4> -map 0:a:0 -af 'silencedetect=noise=-45dB:d=0.3' -f null -
```

## 附录 B：核心结论一页纸

- **每个 SFX 的 `peak_offset_s`（@44100 / 帧 @30fps）**：`impact-cine 0.5511 / 16.53f`、`whoosh-fast 0.7128 / 21.39f`、`transition-snap 0.1174 / 3.52f`、`click-camera 0.1945 / 5.84f`、`swoosh-quick 0.2959 / 8.88f`、`transition-soft 0.4346 / 13.04f`。
- **建议 priming 输出偏移常数 = 0.000 s = 0.00 f**（本管线 `elst media_time=1024` 已补偿；本管线 encoder delay 实测 1024 samples @48k = 0.021333 s / 0.64f，非判例 2048 / 1.28f；6 条 SFX 互相关残差全 0.000s）。换容器/编码器须重测，无 edit list 时扣 0.021333 s。
- **公式**：`from_s = 目标峰值帧/30 − peak_offset_s − 0.000`；`data-duration = min(源时长, 镜末 − from_s, 20 − from_s)`。
- **s01 impact-cine 处置**：`data-start 0 → 0.049`、`data-duration 4.063 → 2.951`、`end 3.000` 恰好不越界；峰值钉在 `f18 (0.600s)`；源尾裁掉 1.112s，而 2.310s 后已 < −60 dBFS，听感无损；`volume 0.85` 不变。
- **数字落定**：弃用 `swoosh-quick`，改 `transition-soft`(f435) + `click-camera` 轻 tick(f444) + `click-camera` 重 tick(f456，150 锁死)。
- **两版 / 试听**：`I −19.4 LUFS / LRA 12.9 LU / TP −1.2 dBFS / 卡点残差 0.000f`；无 BGM 版 74.6% 静音占比是强判据；§6 命令级两版渲染步骤待补做，人工试听仍为唯一不可替代项。
