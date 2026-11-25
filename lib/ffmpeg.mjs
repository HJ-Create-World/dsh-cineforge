/**
 * CineForge / ffmpeg 与 ffprobe 定位器（零依赖）
 *
 * 为什么单独一层：原型脚本把本机 winget 绝对路径写死在源码里，
 * 换台机器就 ENOENT。转正后按以下顺序解析，并把最终来源回报给调用方，
 * 让 UI 与终检报告能写清"用的是哪一个二进制"。
 *
 *   1. CINEFORGE_FFMPEG（指向 ffmpeg 可执行文件；ffprobe 取其同目录同名文件）
 *   2. CINEFORGE_FFPROBE（单独覆盖 ffprobe）
 *   3. PATH 中的 ffmpeg / ffprobe
 *   4. 已知安装位置（winget / chocolatey / scoop / 常见手装目录）
 *
 * 找不到时抛出带"已尝试路径"的错误，不静默降级 —— 分析任务没有 ffmpeg
 * 就是不能跑，静默降级会让用户拿到一份空报告。
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const EXE = process.platform === "win32" ? ".exe" : "";

/** Windows 上按 PATHEXT 语义判断可执行文件是否存在。 */
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/** 在 PATH 的每个目录里找 name（自动补 .exe）。 */
export function whichSync(name) {
  const dirs = String(process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name + EXE);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

const KNOWN = [
  // winget: Gyan.FFmpeg
  "C:/Users/15056/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin",
  // 常见手装
  "C:/ffmpeg/bin",
  "C:/Program Files/ffmpeg/bin",
  "C:/ProgramData/chocolatey/bin",
];

function fromDir(dir) {
  if (!dir) return null;
  const p = path.join(dir, "ffmpeg" + EXE);
  return isFile(p) ? p : null;
}

/**
 * 解析 ffmpeg 与 ffprobe 的绝对路径。
 * @returns {{ffmpeg:string, ffprobe:string, source:string, tried:string[]}}
 */
export function resolveFfmpeg(env = process.env) {
  const tried = [];
  const ffmpegEnv = env.CINEFORGE_FFMPEG;
  if (ffmpegEnv) {
    tried.push("CINEFORGE_FFMPEG=" + ffmpegEnv);
    if (isFile(ffmpegEnv)) {
      const ffprobe = env.CINEFORGE_FFPROBE && isFile(env.CINEFORGE_FFPROBE)
        ? env.CINEFORGE_FFPROBE
        : path.join(path.dirname(ffmpegEnv), "ffprobe" + EXE);
      if (!isFile(ffprobe)) throw new Error("CINEFORGE_FFMPEG 已设置，但同目录找不到 ffprobe：" + ffprobe);
      return { ffmpeg: ffmpegEnv, ffprobe, source: "env", tried };
    }
    throw new Error("CINEFORGE_FFMPEG 指向的文件不存在：" + ffmpegEnv);
  }

  const onPath = whichSync("ffmpeg");
  if (onPath) {
    const ffprobe = whichSync("ffprobe") || path.join(path.dirname(onPath), "ffprobe" + EXE);
    if (!isFile(ffprobe)) throw new Error("PATH 中有 ffmpeg 但没有 ffprobe：" + onPath);
    return { ffmpeg: onPath, ffprobe, source: "path", tried };
  }
  tried.push("PATH");

  for (const dir of KNOWN) {
    tried.push(dir);
    const hit = fromDir(dir);
    if (!hit) continue;
    const ffprobe = path.join(dir, "ffprobe" + EXE);
    if (!isFile(ffprobe)) throw new Error("找到 ffmpeg 但同目录没有 ffprobe：" + dir);
    return { ffmpeg: hit, ffprobe, source: "known:" + dir, tried };
  }

  throw new Error(
    "找不到 ffmpeg。请安装 ffmpeg 并加入 PATH，或设置环境变量 CINEFORGE_FFMPEG 指向 ffmpeg 可执行文件。" +
    String.fromCharCode(10) + "已尝试：" + tried.join(" / ")
  );
}

/**
 * 执行子进程并按需取二进制输出。
 * @param {string} bin 可执行文件绝对路径
 * @param {string[]} args 参数
 * @param {{binary?: boolean, maxBuffer?: number}} [opts]
 * @returns {Promise<Buffer|string>}
 */
export function run(bin, args, opts = {}) {
  const binary = !!opts.binary;
  const maxBuffer = opts.maxBuffer || 512 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = [];
    const err = [];
    let outBytes = 0;
    child.stdout.on("data", (chunk) => {
      outBytes += chunk.length;
      if (outBytes > maxBuffer) {
        child.kill();
        reject(new Error("ffmpeg 输出超过 " + maxBuffer + " 字节上限，已终止：" + bin));
        return;
      }
      out.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err.push(chunk);
      if (err.length > 512) err.shift();
    });
    child.on("error", (e) => reject(new Error("无法启动 " + bin + "：" + e.message)));
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(err).toString("utf8").trim().slice(-900);
        reject(new Error(bin.split(/[\\/]/).pop() + " 退出码 " + code + "：" + detail));
        return;
      }
      const buf = Buffer.concat(out);
      resolve(binary ? buf : buf.toString("utf8"));
    });
  });
}

/** 解析 ffprobe 的 -show_streams -show_format JSON。 */
export async function probeMedia(ffprobe, file) {
  const raw = await run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  const j = JSON.parse(raw);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  if (!v) throw new Error("不是可解析的视频文件（没有视频流）：" + file);
  const [n, d] = String(v.r_frame_rate || "0/1").split("/").map(Number);
  const fps = d ? n / d : n;
  return {
    width: v.width,
    height: v.height,
    fps: Number(fps.toFixed(3)),
    duration_s: Number(Number(j.format.duration).toFixed(3)),
    has_audio: !!a,
    video_codec: v.codec_name || null,
    audio_codec: a ? a.codec_name || null : null,
    size_bytes: Number(j.format.size) || null,
    format_name: j.format.format_name || null,
  };
}
