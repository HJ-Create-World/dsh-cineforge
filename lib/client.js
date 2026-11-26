/**
 * dsh-cineforge — 客户端半身（浏览器侧）
 *
 * 两个入口，一对槽位：
 *   1) 左侧栏一行（slot: sidebar.panellist，id = dsh-cineforge）
 *   2) 配对的 main 面板（slot: main，key 必须等于上面的 id）
 * 两者在同一个 ctx.slots.inject('main', () => ctx.slots.inject('sidebar.panellist', …))
 * 作用域里成对注册、成对回收（依据 dsh-config-sync-plugin/client.js 的头注释契约）。
 *
 * 纪律：
 *   - 不 import 任何 @deepseek-ai/dsh-client-*；React 走 require('react')。
 *   - 零第三方依赖：样式手写、一次性注入 <style id="dsh-cineforge-styles">。
 *   - 所有类名以 cfw 前缀（.cfw / .cfw-*），不写全局选择器、不改宿主主题。
 *   - 所有 fetch 都走 /dsh-cineforge/*，同源；失败只降级不抛。
 *     （不能挂 /api 前缀：那是 dsh-client-connection 独占的 RPC 通道，未带 launch token 一律 401。）
 *   - 面板根常驻 padding-block-start: var(--dsh-frame-top-clearance)，让开宿主标题栏。
 */
window.__ModuleLoader__.load({
  id: 'dsh-cineforge',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const react = require('react')
    const h = react.createElement
    const useState = react.useState
    const useEffect = react.useEffect
    const useMemo = react.useMemo
    const useCallback = react.useCallback
    const useRef = react.useRef

    const PANEL_ID = 'dsh-cineforge'
    const API = '/dsh-cineforge'

    // ── i18n（宿主传 locale 时用，缺省中文） ──────────────────────────
    function M(zh, en) { return zh }

    // ── 样式：全部 scope 在 .cfw 下，一次性注入，卸载时移除 ──────────────
    const CSS_TEXT = [
      '.cfw{--cf-ground:#0B0E14;--cf-alt:#0E121A;--cf-surface:#161B24;--cf-field:#121822;--cf-line:#232A36;--cf-line2:#2C3646;--cf-track:#2E3849;--cf-ink:#F4F1EA;--cf-body:#C7C2B7;--cf-muted:#A9B2C0;--cf-dim:#8E98A8;--cf-faint:#7E8899;--cf-accent:#D3923C;--cf-accsoft:rgba(211,146,60,.10);--cf-onacc:#0B0E14;--cf-ok:#4FA97D;--cf-oksoft:#131A18;--cf-okline:#1F3A30;--cf-oktext:#8FB8A4;--cf-warn:#E0A53C;--cf-warntext:#C9A464;--cf-bad:#E05B4B;--cf-pitbg:#171310;--cf-pitline:#2A2118;--cf-pittext:#8A7A5C;--cf-shadow:0 6px 18px rgba(0,0,0,.45);box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;padding-block-start:var(--dsh-frame-top-clearance,0px);background:var(--cf-ground);color:var(--cf-body);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden}',
      '.cfw[data-theme=light]{--cf-ground:#F7F5F0;--cf-alt:#F1EEE7;--cf-surface:#FFFFFF;--cf-field:#FBFAF6;--cf-line:#E3DED3;--cf-line2:#D5CFC1;--cf-track:#DCD6C8;--cf-ink:#1B1E24;--cf-body:#3C4048;--cf-muted:#4E545C;--cf-dim:#5A6068;--cf-faint:#666C76;--cf-accent:#9A5B12;--cf-accsoft:rgba(154,91,18,.09);--cf-onacc:#FFFFFF;--cf-ok:#2C7A57;--cf-oksoft:#EAF4EE;--cf-okline:#C6E0D1;--cf-oktext:#2C6B4D;--cf-warn:#9A6608;--cf-warntext:#8A5C06;--cf-bad:#B23A2C;--cf-pitbg:#FBF6EA;--cf-pitline:#EADFC6;--cf-pittext:#8A6B34;--cf-shadow:0 6px 18px rgba(60,50,30,.10)}',
      '.cfw *{box-sizing:border-box}',
      '.cfw ::-webkit-scrollbar{width:10px;height:10px}.cfw ::-webkit-scrollbar-thumb{background:var(--cf-line2);border-radius:6px;border:3px solid transparent;background-clip:content-box}.cfw ::-webkit-scrollbar-track{background:transparent}',
      '.cfw-top{display:flex;align-items:center;gap:10px;height:48px;padding:0 12px;border-bottom:1px solid var(--cf-line);background:var(--cf-alt);flex:0 0 auto}',
      '.cfw-logo{display:flex;align-items:center;gap:7px;font-weight:700;letter-spacing:.14em;font-size:11px;color:var(--cf-ink);white-space:nowrap}',
      '.cfw-logo i{width:8px;height:8px;border-radius:2px;background:var(--cf-accent);display:block}',
      '.cfw-proj{display:flex;flex-direction:column;line-height:1.25;min-width:0;padding-left:10px;border-left:1px solid var(--cf-line)}',
      '.cfw-proj b{font-size:12.5px;color:var(--cf-ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px}',
      '.cfw-proj s{text-decoration:none;font-size:10.5px;color:var(--cf-faint);font-family:ui-monospace,Consolas,monospace;letter-spacing:.02em}',
      '.cfw-badge{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;border:1px solid var(--cf-line2);font-size:10.5px;color:var(--cf-dim);white-space:nowrap;background:var(--cf-surface)}',
      '.cfw-badge b{color:var(--cf-ink);font-weight:600}',
      '.cfw-badge i{width:5px;height:5px;border-radius:50%;background:var(--cf-ok);display:block}',
      '.cfw-badge.on{border-color:var(--cf-okline);background:var(--cf-oksoft);color:var(--cf-oktext)}',
      '.cfw-badge.auto{border-color:var(--cf-accent);color:var(--cf-accent);background:var(--cf-accsoft);cursor:pointer}',
      '.cfw-sp{flex:1}',
      '.cfw-ib{width:26px;height:26px;border-radius:6px;border:1px solid var(--cf-line2);background:var(--cf-surface);color:var(--cf-muted);cursor:pointer;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center}',
      '.cfw-ib:hover{border-color:var(--cf-accent);color:var(--cf-accent)}',
      '.cfw-save{font-size:11px;color:var(--cf-faint);white-space:nowrap}',
      '.cfw-btn{height:26px;padding:0 11px;border-radius:6px;border:1px solid var(--cf-line2);background:var(--cf-surface);color:var(--cf-body);font-size:12px;cursor:pointer;white-space:nowrap}',
      '.cfw-btn:hover:not(:disabled){border-color:var(--cf-accent);color:var(--cf-accent)}',
      '.cfw-btn.pri{background:var(--cf-accent);border-color:var(--cf-accent);color:var(--cf-onacc);font-weight:600}',
      '.cfw-btn.pri:hover:not(:disabled){filter:brightness(1.07)}',
      '.cfw-btn:disabled{opacity:.42;cursor:not-allowed}',
      '.cfw-body{flex:1;min-height:0;display:grid;grid-template-columns:270px minmax(0,1fr) 302px}',
      '.cfw-col{min-width:0;min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--cf-line);background:var(--cf-ground)}',
      '.cfw-col:last-child{border-right:0;border-left:1px solid var(--cf-line)}',
      '.cfw-ph{display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-bottom:1px solid var(--cf-line);flex:0 0 auto;background:var(--cf-alt)}',
      '.cfw-ph b{font-size:11px;letter-spacing:.1em;color:var(--cf-ink);font-weight:600;text-transform:uppercase}',
      '.cfw-ph s{text-decoration:none;font-size:10.5px;color:var(--cf-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cfw-sc{flex:1;min-height:0;overflow:auto;padding:10px 12px 18px}',
      '.cfw-lbl{font-size:10px;letter-spacing:.1em;color:var(--cf-faint);text-transform:uppercase;margin:12px 0 6px}',
      '.cfw-lbl:first-child{margin-top:2px}',
      '.cfw-f{margin-bottom:9px}',
      '.cfw-f>em{display:block;font-style:normal;font-size:10.5px;color:var(--cf-faint);margin-bottom:3px}',
      '.cfw-val{min-height:24px;padding:5px 7px;border-radius:5px;border:1px solid var(--cf-line);background:var(--cf-field);color:var(--cf-ink);font-size:12px;line-height:1.45;outline:none}',
      '.cfw-val:focus{border-color:var(--cf-accent)}',
      '.cfw-val.ph{color:var(--cf-faint)}',
      '.cfw-val.usr{border-left:2px solid var(--cf-accent)}',
      '.cfw-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.cfw-chiprow{display:flex;flex-wrap:wrap;gap:5px}',
      '.cfw-chip{height:22px;padding:0 8px;border-radius:999px;border:1px solid var(--cf-line2);background:var(--cf-surface);color:var(--cf-dim);font-size:11px;cursor:pointer;display:inline-flex;align-items:center}',
      '.cfw-chip:hover{border-color:var(--cf-accent);color:var(--cf-accent)}',
      '.cfw-chip.on{border-color:var(--cf-accent);background:var(--cf-accsoft);color:var(--cf-accent)}',
      '.cfw-hint{font-size:11px;line-height:1.6;color:var(--cf-faint);padding:7px 8px;border-radius:5px;border:1px dashed var(--cf-line2);margin-top:8px}',
      '.cfw-hint.warn{border-color:var(--cf-pitline);background:var(--cf-pitbg);color:var(--cf-pittext)}',
      '.cfw-gates{margin-top:10px;border-top:1px solid var(--cf-line);padding-top:8px;display:flex;flex-direction:column;gap:1px}',
      '.cfw-gr{display:flex;align-items:center;gap:7px;padding:4px 2px;font-size:11.5px;color:var(--cf-body)}',
      '.cfw-gr .bx{width:14px;height:14px;border-radius:3px;border:1px solid var(--cf-line2);display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent;flex:0 0 auto;background:var(--cf-surface)}',
      '.cfw-gr .bx.on{background:var(--cf-ok);border-color:var(--cf-ok);color:#04120b}',
      '.cfw-gr .bx.auto{border-color:var(--cf-okline);background:var(--cf-oksoft);color:var(--cf-oktext)}',
      '.cfw-gr s{text-decoration:none;margin-left:auto;font-size:10px;color:var(--cf-faint)}',
      '.cfw-tabs{display:flex;gap:0;border-bottom:1px solid var(--cf-line);flex:0 0 auto;background:var(--cf-alt)}',
      '.cfw-tab{height:30px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:none;color:var(--cf-faint);font-size:11.5px;cursor:pointer}',
      '.cfw-tab.on{color:var(--cf-ink);border-bottom-color:var(--cf-accent)}',
      '.cfw-srctabs{display:flex;gap:3px;margin:2px 0 8px}',
      '.cfw-src{flex:1;height:24px;border-radius:5px;border:1px solid var(--cf-line2);background:var(--cf-surface);color:var(--cf-faint);font-size:11px;cursor:pointer}',
      '.cfw-src.on{border-color:var(--cf-accent);background:var(--cf-accsoft);color:var(--cf-accent)}',
      '.cfw-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px}',
      '.cfw-shot{border:1px solid var(--cf-line);border-radius:7px;background:var(--cf-surface);overflow:hidden;cursor:pointer;position:relative;display:flex;flex-direction:column}',
      '.cfw-shot.sel{border-color:var(--cf-accent);box-shadow:0 0 0 1px var(--cf-accent) inset}',
      '.cfw-thumb{position:relative;aspect-ratio:16/9;background:var(--cf-alt);overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '.cfw-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.cfw-thumb .nopv{font-size:10px;color:var(--cf-faint);text-align:center;line-height:1.5;padding:6px}',
      '.cfw-thumb .dur{position:absolute;right:5px;bottom:5px;background:rgba(0,0,0,.62);color:#fff;font:10px/1 ui-monospace,Consolas,monospace;padding:3px 5px;border-radius:3px}',
      '.cfw-thumb .lk{position:absolute;left:5px;top:5px;width:16px;height:16px;border-radius:3px;background:var(--cf-accent);color:var(--cf-onacc);font:9.5px/16px ui-monospace,monospace;text-align:center;font-weight:700}',
      '.cfw-sb{padding:6px 8px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.cfw-sh{display:flex;align-items:center;gap:5px;min-width:0}',
      '.cfw-sno{font:10px/1 ui-monospace,Consolas,monospace;color:var(--cf-faint);flex:0 0 auto}',
      '.cfw-snm{font-size:11.5px;color:var(--cf-ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cfw-sintent{font-size:10.5px;color:var(--cf-dim);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.cfw-smeta{display:flex;gap:4px;flex-wrap:wrap}',
      '.cfw-tag{font:9.5px/1 ui-monospace,Consolas,monospace;padding:2px 4px;border-radius:3px;border:1px solid var(--cf-line2);color:var(--cf-faint)}',
      '.cfw-tag.e{color:var(--cf-accent);border-color:var(--cf-accent)}',
      '.cfw-sec{border:1px solid var(--cf-line);border-radius:7px;background:var(--cf-surface);padding:9px 10px;margin-top:10px}',
      '.cfw-sec>h4{margin:0 0 7px;font-size:10px;letter-spacing:.1em;color:var(--cf-faint);text-transform:uppercase;font-weight:600;display:flex;align-items:center;gap:6px}',
      '.cfw-sec>h4 em{font-style:normal;letter-spacing:0;text-transform:none;color:var(--cf-dim);font-weight:400;margin-left:auto}',
      '.cfw-svg{width:100%;display:block;overflow:visible}',
      '.cfw-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--cf-faint);margin-top:6px}',
      '.cfw-leg i{display:inline-block;width:9px;height:2px;margin-right:4px;vertical-align:middle}',
      '.cfw-anim{display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:start}',
      '.cfw-phone{position:relative;border-radius:8px;overflow:hidden;background:#000;aspect-ratio:9/16;border:1px solid var(--cf-line2)}',
      '.cfw-phone img,.cfw-phone video{width:100%;height:100%;object-fit:cover;display:block}',
      '.cfw-phone .tag{position:absolute;left:4px;bottom:4px;font:9px/1 ui-monospace,monospace;background:rgba(0,0,0,.65);color:#eee;padding:3px 4px;border-radius:3px}',
      '.cfw-facts{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--cf-dim);line-height:1.5}',
      '.cfw-facts b{color:var(--cf-ink);font-weight:600}',
      '.cfw-gate{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:7px;border:1px solid var(--cf-okline);background:var(--cf-oksoft)}',
      '.cfw-gate .dot{width:7px;height:7px;border-radius:50%;background:var(--cf-ok);flex:0 0 auto}',
      '.cfw-gate p{margin:0;font-size:11.5px;color:var(--cf-oktext);flex:1;line-height:1.5}',
      '.cfw-search{height:26px;padding:0 8px;border-radius:5px;border:1px solid var(--cf-line);background:var(--cf-field);color:var(--cf-ink);font-size:11.5px;width:100%;outline:none;margin:8px 0}',
      '.cfw-search:focus{border-color:var(--cf-accent)}',
      '.cfw-cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}',
      '.cfw-cat{height:20px;padding:0 6px;border-radius:4px;border:1px solid var(--cf-line2);background:var(--cf-surface);color:var(--cf-faint);font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:3px}',
      '.cfw-cat.on{border-color:var(--cf-accent);color:var(--cf-accent);background:var(--cf-accsoft)}',
      '.cfw-cat s{text-decoration:none;opacity:.7}',
      '.cfw-lib{display:flex;flex-direction:column;gap:5px}',
      '.cfw-lc{display:grid;grid-template-columns:40px minmax(0,1fr);gap:7px;align-items:center;padding:5px;border-radius:5px;border:1px solid transparent;cursor:pointer;background:var(--cf-field)}',
      '.cfw-lc:hover{border-color:var(--cf-line2)}',
      '.cfw-lc .th{width:40px;height:26px;border-radius:3px;overflow:hidden;background:var(--cf-alt);display:flex;align-items:center;justify-content:center;font:8px/1 ui-monospace,monospace;color:var(--cf-faint)}',
      '.cfw-lc .th img{width:100%;height:100%;object-fit:cover}',
      '.cfw-lc .nm{font-size:11px;color:var(--cf-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cfw-lc .mt{font:9.5px/1.4 ui-monospace,monospace;color:var(--cf-faint)}',
      '.cfw-tplrow{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:5px;border:1px solid var(--cf-line);background:var(--cf-field);cursor:pointer;margin-bottom:4px}',
      '.cfw-tplrow.on{border-color:var(--cf-accent);background:var(--cf-accsoft)}',
      '.cfw-tplrow b{font-size:11px;color:var(--cf-ink);font-weight:600;white-space:nowrap}',
      '.cfw-tplrow s{text-decoration:none;font-size:10px;color:var(--cf-faint);margin-left:auto;white-space:nowrap}',
      '.cfw-bot{display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-top:1px solid var(--cf-line);background:var(--cf-alt);flex:0 0 auto;overflow:hidden}',
      '.cfw-steps{display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden}',
      '.cfw-step{font-size:10.5px;color:var(--cf-faint);padding:3px 6px;border-radius:4px;white-space:nowrap}',
      '.cfw-step.done{color:var(--cf-oktext)}',
      '.cfw-step.now{color:var(--cf-accent);background:var(--cf-accsoft);border:1px solid var(--cf-accent)}',
      '.cfw-metric{font-size:10.5px;color:var(--cf-faint);white-space:nowrap}',
      '.cfw-metric b{color:var(--cf-body);font-weight:600}',
      '.cfw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;text-align:center;padding:30px}',
      '.cfw-empty b{font-size:14px;color:var(--cf-ink);font-weight:600}',
      '.cfw-empty p{margin:0;font-size:12px;color:var(--cf-faint);max-width:420px;line-height:1.7}',
      '.cfw-code{font:11px/1.7 ui-monospace,Consolas,monospace;color:var(--cf-body);background:var(--cf-field);border:1px solid var(--cf-line);border-radius:6px;padding:9px 11px;text-align:left;max-width:520px;white-space:pre-wrap}',
      '.cfw-sk{height:1px;background:linear-gradient(90deg,transparent,var(--cf-line2),transparent);margin:8px 0}',
      '.cfw-banner{display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:11.5px;border-radius:6px;margin:8px 12px 0;flex:0 0 auto}',
      '.cfw-banner.warn{background:var(--cf-pitbg);border:1px solid var(--cf-pitline);color:var(--cf-pittext)}',
      '.cfw-banner.bad{background:rgba(224,91,75,.10);border:1px solid rgba(224,91,75,.35);color:#E08C80}',
      '.cfw-banner .x{margin-left:auto;background:none;border:0;color:inherit;cursor:pointer;font-size:13px;padding:0 2px}',
      '.cfw-shot{cursor:grab}',
      '.cfw-shot.dragging{opacity:.4}',
      '.cfw-shot.over{outline:2px dashed var(--cf-accent);outline-offset:-2px}',
      '.cfw-shot .rz{position:absolute;right:0;top:0;bottom:0;width:7px;cursor:ew-resize;z-index:5}',
      '.cfw-shot .rz:hover{background:var(--cf-accsoft)}',
      '.cfw-shot .lk{cursor:pointer}',
      '.cfw-lc[draggable=true]{cursor:grab}',
      '.cfw-lc.dragging{opacity:.4}',
      '.cfw-lc.over{outline:2px dashed var(--cf-accent);outline-offset:-2px}',
      '.cfw-side{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:50}',
      '.cfw-modal{width:min(600px,90%);max-height:80vh;overflow:auto;background:var(--cf-surface);border:1px solid var(--cf-line2);border-radius:9px;box-shadow:var(--cf-shadow);padding:16px 18px;display:flex;flex-direction:column;gap:10px}',
      '.cfw-modal h3{margin:0;font-size:13px;color:var(--cf-ink);font-weight:600}',
      '.cfw-modal p{margin:0;font-size:12px;color:var(--cf-body);line-height:1.75}',
      '.cfw-modal .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '.cfw-modal pre{margin:0;font:10.5px/1.55 ui-monospace,monospace;background:var(--cf-field);border:1px solid var(--cf-line);border-radius:5px;padding:7px 9px;max-height:180px;overflow:auto;color:var(--cf-muted)}',
      '.cfw-find{display:flex;gap:6px;align-items:flex-start;font-size:11.5px;line-height:1.65;padding:4px 0;border-top:1px solid var(--cf-line)}',
      '.cfw-find b{flex:0 0 auto;font:10px/1.7 ui-monospace,monospace;padding:0 5px;border-radius:3px;min-width:22px;text-align:center}',
      '.cfw-find.error b{background:rgba(224,91,75,.18);color:#E08C80}',
      '.cfw-find.warn b{background:rgba(224,165,60,.16);color:var(--cf-warntext)}',
      '.cfw-find.info b{background:var(--cf-field);color:var(--cf-faint)}',
      '.cfw-toast{position:fixed;right:18px;bottom:18px;z-index:60;max-width:320px;background:var(--cf-surface);border:1px solid var(--cf-line2);border-radius:7px;padding:8px 12px;font-size:12px;color:var(--cf-body);box-shadow:var(--cf-shadow)}',
      // ── 0.4.2：验收墙 / 发布检查 / 未保存提示 ──
      '.cfw-side.wall{align-items:flex-start;padding:26px 18px;overflow:auto}',
      '.cfw-modal.wide{width:min(1000px,96%)}',
      '.cfw-modal .hd{display:flex;align-items:center;gap:9px}',
      '.cfw-modal .hd s{text-decoration:none;margin-left:auto;font-size:11px;color:var(--cf-faint)}',
      '.cfw-wall{display:flex;flex-direction:column;gap:10px}',
      '.cfw-wall .sheet{width:100%;border:1px solid var(--cf-line);border-radius:6px;display:block}',
      '.cfw-frames{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:7px}',
      '.cfw-frame{position:relative;border:1px solid var(--cf-line);border-radius:5px;overflow:hidden;background:var(--cf-field);cursor:zoom-in}',
      '.cfw-frame img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover}',
      '.cfw-frame s{position:absolute;left:4px;bottom:4px;font:10px/1.4 ui-monospace,monospace;text-decoration:none;padding:0 5px;border-radius:3px;background:rgba(0,0,0,.62);color:#F4F1EA}',
      '.cfw-gtable{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:5px}',
      '.cfw-gcell{display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:5px;border:1px solid var(--cf-line);background:var(--cf-field);font-size:11px;color:var(--cf-dim)}',
      '.cfw-gcell b{color:var(--cf-ink);font-weight:600;font-family:ui-monospace,monospace;font-size:11px}',
      '.cfw-gcell.bad{border-color:rgba(224,91,75,.45)}',
      '.cfw-gcell.warn{border-color:var(--cf-pitline);background:var(--cf-pitbg)}',
      '.cfw-pf{display:flex;flex-direction:column;gap:1px;border:1px solid var(--cf-line);border-radius:6px;overflow:hidden}',
      '.cfw-pf-item{display:flex;gap:8px;align-items:flex-start;padding:7px 10px;background:var(--cf-surface);border-top:1px solid var(--cf-line);font-size:11.5px;line-height:1.65}',
      '.cfw-pf-item:first-child{border-top:0}',
      '.cfw-pf-item .st{flex:0 0 auto;font:10px/1.7 ui-monospace,monospace;padding:0 5px;border-radius:3px;min-width:44px;text-align:center;margin-top:1px}',
      '.cfw-pf-item.pass .st{background:var(--cf-oksoft);color:var(--cf-oktext);border:1px solid var(--cf-okline)}',
      '.cfw-pf-item.fail .st{background:rgba(224,91,75,.16);color:#E08C80;border:1px solid rgba(224,91,75,.35)}',
      '.cfw-pf-item.todo .st{background:var(--cf-pitbg);color:var(--cf-pittext);border:1px solid var(--cf-pitline)}',
      '.cfw-pf-item b{color:var(--cf-ink);font-weight:600}',
      '.cfw-pf-item .d{color:var(--cf-muted)}',
      '.cfw-pf-item .fx{color:var(--cf-faint);font-size:11px;margin-top:1px}',
      '.cfw-pf-item .tagb{margin-left:auto;font-size:10px;color:var(--cf-faint);flex:0 0 auto}',
      '.cfw-chk{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--cf-body);cursor:pointer;padding:7px 9px;border-radius:5px;border:1px dashed var(--cf-line2)}',
      '.cfw-chk input{accent-color:var(--cf-accent)}',
      '.cfw-dirty{position:absolute;left:0;right:0;top:48px;height:2px;background:var(--cf-accent);z-index:20;animation:cfwpulse 1.1s ease-in-out infinite}',
      '@keyframes cfwpulse{0%,100%{opacity:.35}50%{opacity:1}}',
      '.cfw-ro{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;border:1px solid var(--cf-pitline);background:var(--cf-pitbg);color:var(--cf-pittext);font-size:10.5px;white-space:nowrap}',
      '.cfw-toast.bad{border-color:rgba(224,91,75,.5);color:#E08C80}',
      // ── 0.5.0：GOAL 条 / 可编辑字段 / 镜头编辑器 / 参考片 / 模板槽位 ──
      '.cfw-goalbar{display:flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-bottom:1px solid var(--cf-line);background:var(--cf-pitbg);font-size:11px;color:var(--cf-pittext);flex:0 0 auto;overflow:hidden}',
      '.cfw-goalbar b{color:var(--cf-ink);font-weight:600}',
      '.cfw-goalbar .st{display:inline-flex;align-items:center;gap:5px;padding:1px 7px;border-radius:999px;border:1px solid var(--cf-line2);font-size:10.5px;white-space:nowrap;color:var(--cf-dim);background:var(--cf-surface)}',
      '.cfw-goalbar .st.ok{border-color:var(--cf-okline);background:var(--cf-oksoft);color:var(--cf-oktext)}',
      '.cfw-goalbar .st.warn{border-color:var(--cf-pitline);background:var(--cf-pitbg);color:var(--cf-pittext)}',
      '.cfw-goal-actions{display:flex;gap:5px;margin-left:auto}',
      '.cfw-in{width:100%;background:var(--cf-field);border:1px solid var(--cf-line);border-radius:5px;color:var(--cf-ink);font:12px/1.45 inherit;padding:4px 7px;resize:vertical;min-height:26px;font-family:inherit}',
      '.cfw-in:focus{outline:none;border-color:var(--cf-accent)}',
      '.cfw-in.usr{border-left:2px solid var(--cf-accent)}',
      '.cfw-in::placeholder{color:var(--cf-faint)}',
      'select.cfw-in{height:27px;padding:0 5px;resize:none}',
      '.cfw-editor{border:1px solid var(--cf-line2);border-radius:7px;background:var(--cf-surface);padding:8px 9px;margin:4px 0 10px}',
      '.cfw-editor .hd{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
      '.cfw-editor .hd b{font-size:11px;color:var(--cf-ink)}',
      '.cfw-editor .hd s{text-decoration:none;font-size:10.5px;color:var(--cf-faint)}',
      '.cfw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '.cfw-refsheet{width:100%;border-radius:6px;border:1px solid var(--cf-line2);margin:6px 0;display:block}',
      '.cfw-refpath{display:flex;gap:6px;align-items:stretch}',
      '.cfw-slot{display:flex;gap:6px;align-items:center;margin-bottom:5px}',
      '.cfw-save-tpl{display:flex;flex-direction:column;gap:5px}',
      '.cfw-sec{border-top:1px solid var(--cf-line);margin:12px 0 8px}',
      '.cfw-slot em{font-style:normal;font-size:10.5px;color:var(--cf-faint);min-width:76px;flex:0 0 auto}',
      '.cfw-shot .lk{cursor:pointer;border:0;font:inherit;padding:0}',
      '.cfw-shot .lk.off{background:var(--cf-line2);color:var(--cf-dim)}',
      '.cfw-mini{height:22px;padding:0 8px;font-size:11px}',
      '@media(max-width:1160px){.cfw-body{grid-template-columns:236px minmax(0,1fr)}.cfw-col:nth-child(3){display:none}}',
      '@container (max-width:900px){.cfw-body{grid-template-columns:1fr}}'
    ].join('')

    // ── 数据层：所有请求都是同源 GET，失败返回 {ok:false} 不抛 ────────────
    async function api(path, init) {
      try {
        const r = await fetch(API + path, Object.assign({ credentials: 'same-origin', headers: { 'Accept': 'application/json' } }, init || {}))
        const txt = await r.text()
        let body
        try { body = JSON.parse(txt) } catch { body = { ok: false, code: 'BAD_JSON', raw: txt.slice(0, 400) } }
        if (!r.ok && body && body.ok === undefined) body = Object.assign({ ok: false, code: 'HTTP_' + r.status }, body)
        body._status = r.status
        return body
      } catch (e) {
        return { ok: false, code: 'NETWORK', message: String((e && e.message) || e) }
      }
    }

    const STAGES = ['IDEA', '简报', '文案', '视觉', '选卡', '分镜', '素材', '实现', '声音', '终检', '交付']
    const STAGE_ORDER = ['idea', 'brief', 'copy', 'visual', 'cards', 'storyboard', 'assets', 'build', 'audio', 'qa', 'deliver']
    const CAT_CN = { opening: '开场', typography: '字卡', 'ui-entrance': '界面', transition: '转场', effects: '特效', interaction: '交互', camera: '运镜', rhythm: '节奏', outro: '收尾', data: '数据' }
    const ENERGY_CN = { low: '低', mid: '中', 'mid-high': '中高', high: '高', peak: '峰值' }
    const PLAT_CN = { douyin: '抖音', bilibili: 'B 站', xiaohongshu: '小红书', wechat: '视频号', youtube: 'YouTube' }
    /** 每个平台会被 UI 吃掉的安全区（来自 knowledge/platform-presets.json，客户端只取文案）。 */
    const PLATFORM_SAFE = {
      douyin: '底部 20% 会被抖音 UI 遮挡',
      bilibili: '标题与字幕要避开右上角 15% 与底部 12%',
      xiaohongshu: '底部 18% 会被小红书 UI 覆盖',
      wechat: '底部 20% 与右侧 12% 是交互区',
      youtube: '右下角订阅/推荐位会挡字',
    }
    /** 模板层的显示名（与服务端 template-apply.mjs 的 LAYER_CN 同表）。 */
    const LAYER_CN = { style: '视觉风格', structure: '分镜结构', motion: '动效配方', sound: '声音设计', script_skeleton: '文案骨架' }

    function stageIndex(stage) {
      const i = STAGE_ORDER.indexOf(String(stage || '').toLowerCase())
      return i < 0 ? 5 : i
    }
    function fmtDur(s) { return (Number(s) || 0).toFixed(1) + 's' }
    function posterUrl(cardId) {
      return cardId ? API + '/asset?src=poster&id=' + encodeURIComponent(cardId) + '.jpg' : ''
    }

    // ── 小组件 ────────────────────────────────────────────────────────
    function Chip(props) {
      return h('button', { type: 'button', className: 'cfw-chip' + (props.on ? ' on' : ''), onClick: props.onClick, title: props.title || '' }, props.label)
    }
    /**
     * 只读字段 / 可编辑字段。
     * 传 onChange 就变成输入框（0.5.0：用户要能直接改，不是只能回对话里改）。
     * 用户改过的字段左侧有一条 amber 竖线（.usr），AI 重写时要先问。
     */
    function Field(props) {
      const v = props.value
      const empty = v === undefined || v === null || v === ''
      const editable = typeof props.onChange === 'function'
      const common = {
        className: 'cfw-in' + (props.userEdited ? ' usr' : ''),
        value: empty ? '' : String(v),
        placeholder: props.placeholder || '',
        title: props.title || '',
        onChange: (e) => props.onChange(e.target.value),
        disabled: !!props.disabled,
        spellCheck: false,
      }
      return h('div', { className: 'cfw-f' },
        h('em', null, props.label, props.hint ? h('s', { style: { marginLeft: '6px', color: 'var(--cf-faint)' } }, props.hint) : null),
        editable
          ? (props.multiline
              ? h('textarea', Object.assign({ rows: props.rows || 2 }, common))
              : h('input', Object.assign({ type: 'text' }, common)))
          : h('div', {
              className: 'cfw-val' + (empty ? ' ph' : '') + (props.userEdited ? ' usr' : ''),
              title: props.title || (empty ? '' : String(v)),
              style: props.multiline ? { whiteSpace: 'pre-wrap' } : null,
            }, empty ? (props.placeholder || '—') : String(v))
      )
    }
    function Thumb(props) {
      const [bad, setBad] = useState(!props.src)
      useEffect(() => { setBad(!props.src) }, [props.src])
      if (bad) return h('div', { className: 'nopv' }, props.alt || '无预览')
      return h('img', {
        src: props.src,
        alt: props.alt || '',
        loading: 'lazy',
        onError: () => setBad(true),
      })
    }


    // ── 0.4.1：多镜操作 / 保存 / 体检 / 放行 ───────────────────────────
    // 全部走服务端 rev CAS：任何一次写回都带 baseRev，409 就弹出「谁改了」面板，
    // 让用户自己决定保留哪一版 —— 服务端绝不自动 merge。

    /** 把 shots 按顺序重排 from（拖拽后必须重算，否则成片会留空档）。 */
    function reflowShots(shots, fps) {
      let cursor = 0
      return shots.map((s) => {
        const dur = Math.max(1, Math.round(Number(s.duration_f) || 90))
        const out = Object.assign({}, s, { from: cursor, duration_f: dur })
        cursor += dur
        return out
      })
    }
    function totalFrames(shots) {
      return (shots || []).reduce((a, s) => a + (Math.round(Number(s.duration_f)) || 0), 0)
    }

    function Toast(props) {
      if (!props.msg) return null
      return h('div', { className: 'cfw-toast' + (props.bad ? ' bad' : '') }, props.msg)
    }

    /** 体检结果面板：error 挡住放行，warn 允许放行但要看见。 */
    function LintPanel(props) {
      const r = props.result
      if (!r) return null
      const list = r.findings || []
      const order = { error: 0, warn: 1, info: 2 }
      const sorted = list.slice().sort((a, b) => (order[a.severity] - order[b.severity]) || (String(a.shot).localeCompare(String(b.shot))))
      return h('div', { className: 'cfw-sec' },
        h('h4', null, '分镜体检', h('em', null, [r.summary.errors + ' error', r.summary.warns + ' warn', r.summary.infos + ' info'].join(' · '))),
        !list.length ? h('div', { className: 'cfw-hint' }, '没有发现问题。放行后画幅与时长锁定。')
          : sorted.slice(0, 12).map((f2, i) => h('div', { key: i, className: 'cfw-find ' + f2.severity },
              h('b', null, f2.rule),
              h('div', null, f2.message)
            )),
        list.length > 12 ? h('div', { className: 'cfw-hint' }, '还有 ' + (list.length - 12) + ' 条') : null
      )
    }

    /** 409 冲突面板：把服务端当前版与本地改动并排，只给「用我的 / 用他的」两个选择。 */
    function ConflictPanel(props) {
      const conflict = props.conflict
      const onKeepMine = props.onKeepMine
      const onTakeTheirs = props.onTakeTheirs
      const onClose = props.onClose
      const cur = (conflict && conflict.current) || {}
      const mine = (conflict && conflict.mine) || {}
      const fmt = (o) => {
        const ss = (o && o.shots) || []
        return ss.length + ' 镜 / ' + ss.reduce((a, s) => a + (Number(s.duration_f) || 0), 0) + 'f / ' + ((o && o.stage) || '—')
      }
      return h('div', { className: 'cfw-side', onClick: onClose },
        h('div', { className: 'cfw-modal', onClick: (e) => e.stopPropagation() },
          h('h3', null, '有人同时改了这份分镜'),
          h('p', null, '服务端现在是 rev ' + (conflict.currentRev || 0) + '，你手上这份基于 rev ' + (conflict.baseRev || 0) + '。工作台不会自动合并 —— 两版同时改会互相覆盖，宁可让你选一次。'),
          h('pre', null, '服务端：' + fmt(cur) + '\n本地  ：' + fmt(mine)),
          h('div', { className: 'row' },
            h('button', { type: 'button', className: 'cfw-btn', onClick: onClose }, '先不动'),
            h('button', { type: 'button', className: 'cfw-btn', onClick: onTakeTheirs }, '用服务端的'),
            h('button', { type: 'button', className: 'cfw-btn pri', onClick: onKeepMine }, '用我的覆盖')
          )
        )
      )
    }

    // ── 0.4.2：静帧验收墙 ─────────────────────────────────────────────
    // 只读展示 verify.json：一张 contact-sheet + 每张静帧 + 八组计数 + warning 明细。
    // 没有验收报告时如实说没有，不画空壳让人误以为「验过了」。
    function VerifyWall(props) {
      const { data, loading, onClose, onGoto } = props
      const v = data && data.verify
      const item = (f) => h('div', {
        key: f.file, className: 'cfw-frame', title: f.file,
        onClick: () => { if (onGoto && f.t !== null) onGoto(f.t) },
      },
        h('img', { src: f.url, alt: f.file, loading: 'lazy' }),
        h('s', null, 'S? ' + (f.t === null ? '—' : fmtDur(f.t)))
      )
      return h('div', { className: 'cfw-side wall', onClick: onClose },
        h('div', { className: 'cfw-modal wide', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'hd' },
            h('h3', null, '静帧验收墙'),
            h('s', null, loading ? '读取中…' : (data && data.found ? (data.verify.frames.length + ' 张静帧 · ' + (data.verify.warning_count || 0) + ' warning') : '还没有验收报告'))
          ),
          !loading && data && !data.found
            ? h('div', null,
                h('p', null, '这个工程还没跑过终检。终检会用 hyperframes 的 8 组检查跑一遍，再在每镜中点抽一帧存 png —— 它能抓出「黑帧 / 空帧 / 元素跑出安全区 / 对比度不够」这类只有看图才发现的问题。'),
                h('pre', null, 'node scripts/verify-hf.mjs --project <工程目录>'),
                h('p', { style: { fontSize: '11px', color: 'var(--cf-faint)' } }, '约 1–2 分钟（要起无头浏览器逐帧截图）。跑完这里会出现静帧与分组报告。'),
                h('p', { style: { fontSize: '11px', color: 'var(--cf-faint)' } }, '找过的位置：' + ((data.tried || []).join(' / ') || '—'))
              )
            : null,
          !loading && v
            ? h('div', { className: 'cfw-wall' },
                h('div', { className: 'cfw-hint' },
                  (v.ok ? '✓ 通过' : '✗ 未通过') + ' · ' + v.error_count + ' error · ' + v.warning_count + ' warning · ' + v.empty_frames + ' 张空静帧'
                  + ' · 采样 ' + (v.sample_times || []).join(' / ') + 's'),
                v.contact_sheet_url ? h('img', { className: 'sheet', src: v.contact_sheet_url, alt: 'contact sheet' }) : null,
                h('div', { className: 'cfw-frames' }, (v.frames || []).map(item)),
                h('div', { className: 'cfw-gtable' },
                  Object.keys(v.groups || {}).map((g) => {
                    const c = v.groups[g] || {}
                    const cls = c.error ? ' bad' : (c.warning ? ' warn' : '')
                    return h('div', { key: g, className: 'cfw-gcell' + cls },
                      h('span', null, g),
                      h('b', null, c.error ? c.error + 'E' : (c.warning ? c.warning + 'W' : 'ok'))
                    )
                  })
                ),
                (v.warnings || []).length
                  ? h('div', null,
                      h('div', { className: 'cfw-lbl' }, '问题明细（' + v.warnings.length + '）'),
                      v.warnings.slice(0, 30).map((w, i) => h('div', { key: i, className: 'cfw-find ' + (w.group === 'error' ? 'error' : 'warn') },
                        h('b', null, w.group),
                        h('div', null, (w.code ? w.code + ' · ' : '') + w.message + (w.fix ? h('div', { style: { color: 'var(--cf-faint)', fontSize: '11px', marginTop: '2px' } }, '修：' + w.fix) : null))
                      )),
                      v.warnings.length > 30 ? h('div', { className: 'cfw-hint' }, '还有 ' + (v.warnings.length - 30) + ' 条') : null
                    )
                  : h('div', { className: 'cfw-hint' }, '没有 warning。'),
                h('div', { className: 'row' },
                  h('button', { type: 'button', className: 'cfw-btn', onClick: onClose }, '关闭')
                )
              )
            : null
        )
      )
    }

    // ── 0.4.2：发布确认弹窗 ────────────────────────────────────────────
    // 九项逐条可见，block 项没全过就不给「记录回执」按钮。
    // 这不是上传：只写回执 + aigc 标识元数据，上传仍是手动。
    function PublishDialog(props) {
      const { data, loading, busy, onClose, onRecord } = props
      const pf = data && data.preflight
      const items = (pf && pf.items) || []
      const [ack, setAck] = useState(false)
      const [note, setNote] = useState('')
      const blocking = (pf && pf.counts && pf.counts.blocking_failed) || 0
      const canRecord = !!pf && pf.ok && ack && !busy
      return h('div', { className: 'cfw-side', onClick: onClose },
        h('div', { className: 'cfw-modal wide', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'hd' },
            h('h3', null, '发布前确认'),
            h('s', null, loading ? '检查中…' : (pf ? (pf.counts.pass + '/' + pf.counts.total + ' 通过 · ' + (pf.ok ? '可以发' : blocking + ' 项阻断')) : ''))
          ),
          h('p', null, '这九项由服务端重算，不是让你勾个「我知道了」。一期不内置上传：确认之后只写回执与 AI 标识元数据，视频文件你自己传到平台。'),
          !loading && items.length
            ? h('div', { className: 'cfw-pf' },
                items.map((it) => h('div', { key: it.id, className: 'cfw-pf-item ' + it.status },
                  h('span', { className: 'st' }, it.status === 'pass' ? '通过' : (it.status === 'fail' ? '阻断' : '待办')),
                  h('div', null,
                    h('b', null, it.label),
                    h('span', { className: 'tagb' }, it.severity === 'block' ? '必过' : '提醒'),
                    h('div', { className: 'd' }, it.detail),
                    it.fix && it.status !== 'pass' ? h('div', { className: 'fx' }, '修：' + it.fix) : null
                  )
                ))
              )
            : (loading ? h('div', { className: 'cfw-hint' }, '正在核对工程…') : null),
          !loading
            ? h('div', null,
                h('div', { className: 'cfw-lbl' }, '补充说明（写进回执）'),
                h('textarea', {
                  className: 'cfw-val', rows: 2, value: note,
                  placeholder: '例：发抖音，封面另做，BGM 已确认可商用',
                  onChange: (e) => setNote(e.target.value),
                }),
                h('label', { className: 'cfw-chk' },
                  h('input', { type: 'checkbox', checked: ack, onChange: (e) => setAck(e.target.checked) }),
                  h('span', null, '我已逐条看过，并会自己在平台上完成上传与审核')
                )
              )
            : null,
          h('div', { className: 'row' },
            h('button', { type: 'button', className: 'cfw-btn', onClick: onClose }, '关闭'),
            h('button', {
              type: 'button', className: 'cfw-btn pri', disabled: !canRecord,
              title: !pf ? '检查还没回来' : (!pf.ok ? '有 ' + blocking + ' 项必过项未通过' : (!ack ? '先勾选确认' : '记录回执')),
              onClick: () => onRecord && onRecord(note),
            }, busy ? '写入中…' : '记录发布回执')
          )
        )
      )
    }

    // ── 顶栏 ──────────────────────────────────────────────────────────
    /**
     * 主题：把 /themes 里的 token 表编译成 CSS 变量覆盖。
     *
     * 为什么不在 CSS_TEXT 里硬写四套：[data-theme=x] 的 token 名和数量会随知识库变化，
     * 硬写等于把知识库抄进客户端。这里一次生成，加主题只要改 knowledge/themes.json。
     */
    function themeCss(themes, defId) {
      const rows = []
      for (const t of themes || []) {
        if (!t || !t.id || !t.tokens || t.id === defId) continue
        const vars = Object.keys(t.tokens).map((k) => '--cf-' + k + ':' + t.tokens[k]).join(';')
        rows.push('.cfw[data-theme="' + t.id + '"]{' + vars + '}')
      }
      return rows.join('\n')
    }

    /** 注入 / 更新主题样式表（幂等，按 id 复用同一个 <style>）。 */
    function applyThemeCss(themes, defId) {
      if (typeof document === 'undefined') return
      const ID = 'dsh-cineforge-theme-tokens'
      let el = document.getElementById(ID)
      const css = themeCss(themes, defId)
      if (!css) { if (el) el.remove(); return }
      if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el) }
      if (el.textContent !== css) el.textContent = css
    }

    /**
     * GOAL 条：一句话说清「现在谁该动手」。
     *
     * 设计取舍：不在这里做「开始/停止」的定时器，GOAL 只是工程里的一份状态，
     * 真正推进由对话里的导演按 safe point 一步步来。界面只做三件事 ——
     * 说清当前状态、说清在等什么、给用户一个明确的下一步。
     */
    function GoalBar(props) {
      const { project, busy, onGoal } = props
      const goal = (project && project.goal) || null
      const stage = (project && project.stage) || ''
      if (!goal) {
        return h('div', { className: 'cfw-goalbar' },
          h('span', { className: 'st' }, 'GOAL 未启用'),
          h('span', null, '启用后导演自动往下推进；分镜与发布两个硬门仍然等你按。'),
          h('div', { className: 'cfw-sp' }),
          h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('start') }, '启用 GOAL')
        )
      }
      const st = goal.status || 'running'
      const cls = st === 'running' ? 'ok' : (st === 'waiting' ? 'warn' : '')
      const stages = ['IDEA', 'BRIEF', 'SCRIPT', 'SPEC', 'MAPPING', 'STORYBOARD', 'ASSETS', 'BUILD', 'SOUND', 'QA', 'DELIVER', 'PUBLISHED']
      const si = stages.indexOf(goal.stage)
      const label = { running: '自动推进中', waiting: '等你拍板', interrupted: '已打断', done: '已完成', failed: '失败' }[st] || st
      const waitTxt = goal.waiting_for === 'storyboard_approve' ? '分镜确认（硬门）' : (goal.waiting_for === 'publish_approve' ? '发布确认（硬门）' : (goal.waiting_for || ''))
      return h('div', { className: 'cfw-goalbar' },
        h('span', { className: 'st ' + cls }, 'GOAL · ' + label),
        h('span', null, '阶段 ' + (si < 0 ? '—' : (si + 1) + '/12 ' + goal.stage) + (st === 'waiting' && waitTxt ? ' · 在等 ' + waitTxt : '')),
        goal.interrupt_requested ? h('span', { className: 'st warn' }, '已请求打断 · 到安全点停') : null,
        h('div', { className: 'cfw-sp' }),
        h('div', { className: 'cfw-goal-actions' },
          st === 'running' ? h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('pause') }, '暂停') : null,
          st === 'interrupted' || st === 'waiting' ? h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('resume') }, '恢复') : null,
          st === 'running' ? h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('interrupt'), title: '不硬停：到下一个阶段边界或单镜渲染完成才停' }, '打断') : null,
          st !== 'done' ? h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('advance'), title: '只走一个阶段，走到硬门会停下等你' }, '推进一阶段') : null,
          h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy, onClick: () => onGoal('disable') }, '关闭')
        )
      )
    }


    function TopBar(props) {
      const { state, onTheme, onBack, project, saving, dirty } = props
      const p = (project && project.project) || {}
      const stage = (project && project.stage) || ''
      const si = stageIndex(stage)
      const auto = state.mode === 'auto'
      const title = p.title || p.idea || p.id || state.name || '未命名工程'
      return h('div', { className: 'cfw-top' },
        h('div', { className: 'cfw-logo' }, h('i'), 'CINEFORGE'),
        h('div', { className: 'cfw-proj' },
          h('b', { title }, title),
          h('s', null, [state.name || '—', 'rev ' + ((project && project.rev) || 0), (stage || 'draft').toUpperCase()].join(' · '))
        ),
        h('div', { className: 'cfw-badge on' }, h('i'), 'GOAL 阶段 ' + (si + 1) + '/11 · ' + (STAGES[si] || '分镜')),
        h('div', {
          className: 'cfw-badge' + (auto ? ' auto' : ''),
          onClick: () => props.onMode(auto ? 'co' : 'auto'),
          title: '自动推进：所有把关点默认自动通过；分镜硬门仍在',
        }, auto ? 'AUTO 自动推进至成片' : 'CO 共创模式'),
        h('div', { className: 'cfw-sp' }),
        h('div', { className: 'cfw-save' }, saving ? '保存中…' : (dirty ? '未保存' : '已保存')),
        h('button', {
          type: 'button', className: 'cfw-ib',
          onClick: props.onTheme,
          title: props.themeName ? ('主题：' + props.themeName + '（点一下切下一个）') : '切换主题',
        }, '◐'),
        h('button', { type: 'button', className: 'cfw-btn', onClick: props.onCopy, title: '把继续指令复制到剪贴板，回到对话粘贴' }, '复制指令'),
        h('button', { type: 'button', className: 'cfw-btn pri', onClick: onBack }, '返回对话')
      )
    }

    // ── A 区：简报 ────────────────────────────────────────────────────
    function SectionA(props) {
      const { project, cards, templates, state, setState, status } = props
      const p = (project && project.project) || {}
      const b = (project && project.brief) || {}
      const tab = state.tab || 'text'
      const set = (k, v) => setState((s) => Object.assign({}, s, { [k]: v }))
      const brief = (k) => (b[k] !== undefined && b[k] !== '' ? b[k] : p[k])
      const edited = (project && project.brief_user_edited) || []
      return h('section', { className: 'cfw-col' },
        h('div', { className: 'cfw-ph' }, h('b', null, 'A · 简报'), h('s', null, status || '')),
        h('div', { className: 'cfw-sc' },
          h('div', { className: 'cfw-srctabs' },
            [['text', '文字'], ['video', '视频'], ['tpl', '模板']].map(([k, label]) =>
              h('button', { key: k, type: 'button', className: 'cfw-src' + (tab === k ? ' on' : ''), onClick: () => set('tab', k) }, label)
            )
          ),
          tab === 'text' ? h(TextPanel, { project, brief, edited, setState, locked: props.locked, onEdit: props.onBrief, onPlatform: props.onPlatform, onSlot: props.onSlot }) : null,
          tab === 'video' ? h(VideoPanel, { project, state, busy: props.busy, onAnalyze: props.onAnalyze, onClearRef: props.onClearRef, locked: props.locked }) : null,
          tab === 'tpl' ? h(TplPanel, {
            templates, state, setState, project, locked: props.locked, onApply: props.onApplyTpl,
            tplSaveName: props.tplSaveName, tplSaveId: props.tplSaveId, tplSaveLayers: props.tplSaveLayers,
            canSaveTpl: props.canSaveTpl, saving: props.saving,
            onTplName: props.onTplName, onTplId: props.onTplId, onTplSaveLayer: props.onTplSaveLayer, onTplSave: props.onTplSave,
          }) : null,
          h(Gates, { project, state, setState })
        )
      )
    }

    function TextPanel(props) {
      const { project, brief, edited, setState } = props
      const p = (project && project.project) || {}
      const platform = (p.platform || 'douyin')
      const presets = { douyin: ['9:16', '1080×1920'], bilibili: ['16:9', '1920×1080'], xiaohongshu: ['3:4', '1080×1440'], wechat: ['9:16', '1080×1920'], youtube: ['16:9', '1920×1080'] }
      const pr = presets[platform] || ['9:16', '1080×1920']
      const onEdit = props.onEdit || function () {}
      const locked = !!props.locked
      const f = (k, label, ph, multiline) => h(Field, {
        label, placeholder: ph, multiline,
        value: brief(k),
        userEdited: edited.indexOf(k) >= 0,
        disabled: locked,
        onChange: (val) => onEdit(k, val),
      })
      const tpl = (project && project.template) || null
      const slots = (tpl && tpl.slots) || {}
      const slotKeys = Object.keys(slots)
      return h('div', null,
        h('div', { className: 'cfw-lbl' }, '一句话 idea'),
        f('idea', '这个片子要做什么', '写一句话 —— 剩下的交给导演扩写', true),
        f('audience', '给谁看', '例如：第一次听说这个产品的人'),
        f('action', '想让 TA 做什么', '例如：点进主页看完整演示'),
        f('pitch', '一句话卖点', '一句话说清「凭什么信」'),
        f('evidence', '证据是什么', '真实截图 / 数据 / 客户原话'),
        f('tone', '调性', '例如：克制、纸墨感、不喊口号'),
        slotKeys.length ? h('div', null,
          h('div', { className: 'cfw-lbl' }, '模板空位 ' + (tpl.slots_complete ? '（已填满）' : '（未填满不能进分镜）')),
          slotKeys.map((k) => h('div', { key: k, className: 'cfw-slot' },
            h('em', null, k),
            h('input', {
              className: 'cfw-in' + (slots[k] ? '' : ' usr'), type: 'text', value: slots[k] || '',
              placeholder: '必填 —— 模板只存怎么拍，这里填拍什么',
              disabled: locked,
              onChange: (e) => props.onSlot && props.onSlot(k, e.target.value),
            })
          ))
        ) : null,
        h('div', { className: 'cfw-lbl' }, '平台与画幅'),
        h('div', { className: 'cfw-chiprow' },
          Object.keys(PLAT_CN).map((k) => h(Chip, {
            key: k, label: PLAT_CN[k], on: platform === k,
            title: '切换平台会联动画幅、时长上限与安全区',
            onClick: locked ? null : () => props.onPlatform && props.onPlatform(k),
          }))
        ),
        h('div', { className: 'cfw-row2', style: { marginTop: '8px' } },
          h(Field, { label: '画幅', value: (p.aspect || pr[0]) }),
          h(Field, { label: '时长', value: fmtDur(p.duration_s) + (p.fps ? ' · ' + p.fps + 'fps' : '') })
        ),
        h('div', { className: 'cfw-hint warn' }, (PLATFORM_SAFE[platform] || '竖屏片底部 20% 会被平台 UI 遮挡') + '　字幕与关键信息不要放进去。')
      )
    }

    function VideoPanel(props) {
      const { project, state } = props
      const ref = (project && project.reference) || null
      const busy = !!props.busy
      const [path, setPath] = useState('')
      const locked = !!props.locked
      const runner = h('div', { className: 'cfw-refpath' },
        h('input', {
          className: 'cfw-in', type: 'text', value: path, disabled: busy || locked,
          placeholder: 'D:\\clips\\ref.mp4 —— 参考片的绝对路径',
          onChange: (e) => setPath(e.target.value),
        }),
        h('button', {
          type: 'button', className: 'cfw-btn pri', disabled: busy || locked || !path.trim(),
          title: '跑 ffmpeg：切镜 + 关键帧 + 风格指纹（长片可能几十秒）',
          onClick: () => props.onAnalyze && props.onAnalyze(path.trim()),
        }, busy ? '分析中…' : '导入分析')
      )
      if (!ref) {
        return h('div', null,
          h('div', { className: 'cfw-hint' }, '贴一段你喜欢的片子，提取「怎么拍」：切点节奏、调色板、明暗、运动强度、BPM。'),
          runner,
          h('div', { className: 'cfw-hint' }, '也可以直接把路径发在对话里，让导演导入。'),
          h('div', { className: 'cfw-lbl' }, '导入后能提取什么'),
          h('div', { className: 'cfw-facts' },
            h('div', null, h('b', null, '切点与节奏'), '：帧差法切分镜头，给中位镜长与切/分'),
            h('div', null, h('b', null, '调色板'), '：主色占比 + 明暗分布'),
            h('div', null, h('b', null, '运动强度'), '：静态占比 / p90 / p99'),
            h('div', null, h('b', null, 'BPM 与卡拍'), '：谐波求和估计，附段间稳定性'),
            h('div', null, h('b', null, '不能做的'), '：不复制画面内容、不反解具体动效')
          )
        )
      }
      const fp = ref.fingerprint || {}
      // 指纹结构：palette 是数组本身（不是 {colors}）；节奏直接挂在 audio 上（不是 audio.rhythm）。
      const pal = (fp.palette && (fp.palette.colors || fp.palette)) || []
      const tone = fp.tone || {}
      const mo = fp.motion || {}
      const rh = (fp.audio && (fp.audio.rhythm || fp.audio)) || ref.rhythm || {}
      const toneVal = (k) => (tone[k + '_pct'] !== undefined ? tone[k + '_pct'] : (tone[k] !== undefined ? tone[k] : '—'))
      const bpmVal = rh.bpm || rh.bpm_est || 0
      const sheet = ref.contact_sheet ? API + '/asset?src=workspace&id=' + encodeURIComponent((state.name || '') + '/' + ref.contact_sheet) + '&v=' + encodeURIComponent(String((project && project.rev) || 0)) : ''
      return h('div', null,
        h('div', { className: 'cfw-f' },
          h('em', null, '参考片'),
          h('div', { className: 'cfw-val' }, (ref.file || 'reference.mp4') + ' · ' + [ref.width, ref.height].filter(Boolean).join('×') + ' · ' + fmtDur(ref.duration_s) + (ref.fps ? ' · ' + Math.round(ref.fps) + 'fps' : ''))
        ),
        sheet ? h('img', { className: 'cfw-refsheet', src: sheet, alt: '切镜拼图', loading: 'lazy' }) : null,
        ref.shots && ref.shots.length ? h('div', { className: 'cfw-hint' }, '已切 ' + ref.shots.length + ' 镜 · 中位镜长 ' + fmtDur(median(ref.shots.map((s) => s.duration_s))) + ' · 拼图按镜序编号') : null,
        h('div', { className: 'cfw-lbl' }, '风格指纹'),
        h('div', { className: 'cfw-facts' },
          h('div', { className: 'cfw-chiprow', style: { margin: '3px 0 6px' } },
            pal.slice(0, 6).map((c, i) => h('span', {
              key: i,
              title: (c.hex || c.color) + ' · ' + Math.round((c.share || 0) * 100) + '%',
              style: { width: '18px', height: '18px', borderRadius: '3px', background: c.hex || c.color, border: '1px solid var(--cf-line2)', display: 'inline-block' },
            }))
          ),
          h('div', null, h('b', null, '明暗 '), '暗 ' + toneVal('dark') + ' · 中 ' + toneVal('mid') + ' · 亮 ' + toneVal('light')),
          h('div', null, h('b', null, '运动 '), '静态 ' + (mo.static_ratio !== undefined ? Math.round(mo.static_ratio * 100) + '%' : '—') + ' · p90 ' + (mo.p90 !== undefined ? mo.p90 : '—') + ' · p99 ' + (mo.p99 !== undefined ? mo.p99 : '—')),
          h('div', null, h('b', null, '节奏 '), (bpmVal ? '≈' + bpmVal + ' BPM' : '没有可用的音轨节奏') + (rh.bpm_is_estimate ? '（估计值）' : '') + (rh.onsets !== undefined ? ' · 起音 ' + rh.onsets + ' 处' : ''))
        ),
        h('div', { className: 'cfw-lbl' }, '复刻什么'),
        h('div', { className: 'cfw-chiprow' },
          ['视觉风格', '分镜结构', '某一段', '不复制内容'].map((x, i) => h(Chip, {
            key: x, label: x, on: i < 2,
            title: i === 2 ? '一期不做片段级语义理解' : (i === 3 ? '永远不复制画面内容，只提取可量化结构' : ''),
          }))
        ),
        sheet ? null : runner,
        h('div', { className: 'cfw-chiprow', style: { marginTop: '8px' } },
          h('button', { type: 'button', className: 'cfw-btn mini', disabled: busy || locked, onClick: () => props.onClearRef && props.onClearRef() }, '删除指纹引用'),
          h('span', { className: 'cfw-hint', style: { margin: 0 } }, '只删工程里的引用，不动你磁盘上的源视频')
        ),
        h('div', { className: 'cfw-hint' }, '参考片只用来提取「怎么拍」，不复制画面内容。指纹存进工程后可以随时删掉源视频。')
      )
    }

    /** 中位数（空数组返回 0）。 */
    function median(arr) {
      const a2 = (arr || []).map(Number).filter((x) => !isNaN(x)).sort((x, y) => x - y)
      if (!a2.length) return 0
      return a2[Math.floor(a2.length / 2)]
    }

    function TplPanel(props) {
      const { templates, state, setState, project } = props
      const list = (templates && templates.templates) || []
      const sel = state.tpl || ''
      const cur = (project && project.template) || null
      const picked = state.tplLayers || ['style', 'structure', 'motion', 'sound']
      const toggleLayer = (k) => setState((s) => {
        const now = (s.tplLayers || ['style', 'structure', 'motion', 'sound']).slice()
        const i = now.indexOf(k)
        if (i >= 0) now.splice(i, 1); else now.push(k)
        return Object.assign({}, s, { tplLayers: now })
      })
      if (!list.length) {
        return h('div', null,
          h('div', { className: 'cfw-hint' }, '模板库还是空的。用 node scripts/extract-template.mjs <视频> --id <名字> 从参考片提取一份，或等内置模板随插件更新。'),
          h('div', { className: 'cfw-hint' }, '模板只存「怎么拍」：调色板、切点密度、段落结构、节奏。不存「拍什么」。')
        )
      }
      return h('div', null,
        h('div', { className: 'cfw-lbl' }, '可用模板 ' + list.length),
        list.map((t) => h('div', {
          key: t.id,
          className: 'cfw-tplrow' + (sel === t.id ? ' on' : ''),
          onClick: () => setState((s) => Object.assign({}, s, { tpl: sel === t.id ? '' : t.id })),
        },
          h('b', null, t.name || t.id),
          h('s', null, (t.structure && t.structure.shot_count ? t.structure.shot_count + ' 镜' : '') + (t.sound && t.sound.bpm ? ' · ' + Math.round(t.sound.bpm) + ' BPM' : ''))
        )),
        cur ? h('div', { className: 'cfw-hint' }, '当前工程已套：' + cur.name + (cur.slots_complete ? ' · 空位已填满' : ' · 空位还差 ' + Object.keys(cur.slots || {}).filter((k) => !cur.slots[k]).length + ' 项')) : null,
        h('div', { className: 'cfw-lbl' }, '复用哪几层'),
        h('div', { className: 'cfw-chiprow' },
          ['style', 'structure', 'motion', 'sound', 'script_skeleton'].map((k) =>
            h(Chip, {
              key: k, label: LAYER_CN[k] || k, on: picked.indexOf(k) >= 0,
              title: k === 'script_skeleton' ? '最容易带进具体文案，默认不选' : '只覆盖这一层，其余字段原样保留',
              onClick: () => toggleLayer(k),
            })
          )
        ),
        h('button', {
          type: 'button', className: 'cfw-btn pri', style: { marginTop: '8px' },
          disabled: !sel || !!props.locked,
          title: sel ? '把选中的层套到当前工程（正文与发布信息不受影响）' : '先选一个模板',
          onClick: () => props.onApply && props.onApply(sel, picked),
        }, '套用到当前工程'),
        h('div', { className: 'cfw-hint' }, '模板只存「怎么拍」，不存「拍什么」。套模板后文案仍要重写；空位没填满不能进分镜。')
      )
    }

    /**
     * 把关点：真实读 project.gates + project.goal，不再写死。
     * 硬门（分镜确认 / 发布）永远由用户按；软门在 GOAL 自动模式下可自动通过。
     */
    function Gates(props) {
      const { project } = props
      const gates = (project && project.gates) || {}
      const goal = (project && project.goal) || null
      const rows = [
        ['分镜确认', '硬门', !!(gates.storyboard && gates.storyboard.open), true],
        ['发布', '硬门', !!(gates.publish && gates.publish.open), true],
        ['文案', '软门', !!(gates.copy && gates.copy.open), false],
        ['视觉方向', '软门', !!(gates.visual && gates.visual.open), false],
        ['静帧验收', '软门', !!(gates.verify && gates.verify.open), false],
      ]
      const override = (g) => ((goal && goal.overrides) || []).some((o) => o && o.gate === g)
      return h('div', { className: 'cfw-gates' },
        h('div', { className: 'cfw-lbl', style: { marginTop: 0 } }, '把关点', goal ? h('s', { style: { marginLeft: '6px', color: 'var(--cf-faint)' } }, 'GOAL 不会替你按硬门') : null),
        rows.map(([label, kind, done, hard]) => h('div', { key: label, className: 'cfw-gr' },
          h('span', { className: 'bx' + (done ? ' on' : '') }, done ? '✓' : ''),
          label,
          h('s', null, kind + (done ? ' · 已通过' : (hard && override(label === '分镜确认' ? 'storyboard_approve' : 'publish_approve') ? ' · 已手写越门' : ' · 待定')))
        ))
      )
    }

    // ── B 区：分镜板 ───────────────────────────────────────────────────
    function EnergyCurve(props) {
      const shots = props.shots || []
      const W = 620, H = 56
      const w = shots.length ? W / shots.length : W
      const pts = shots.map((s, i) => {
        const v = { low: 0.25, mid: 0.5, 'mid-high': 0.72, high: 0.88, peak: 1 }[s.energy || 'mid'] || 0.5
        return [w * (i + 0.5), H - 6 - v * (H - 14)]
      })
      const path = pts.length ? pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') : ''
      return h('svg', { className: 'cfw-svg', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', style: { height: '52px' } },
        h('line', { x1: 0, y1: H - 4, x2: W, y2: H - 4, stroke: 'var(--cf-line2)', strokeWidth: '1' }),
        h('path', { d: 'M0 ' + (H - 16) + ' Q ' + (W * 0.35) + ' ' + (H - 34) + ' ' + (W * 0.62) + ' ' + (H - 30) + ' T ' + W + ' ' + (H - 8), fill: 'none', stroke: 'var(--cf-line2)', strokeWidth: '1', strokeDasharray: '4 4' }),
        path ? h('path', { d: path, fill: 'none', stroke: 'var(--cf-accent)', strokeWidth: '1.8' }) : null,
        pts.map((p, i) => h('circle', { key: i, cx: p[0], cy: p[1], r: '3.2', fill: 'var(--cf-accent)' }))
      )
    }

    function Strip(props) {
      const shots = props.shots || []
      const W = 620, H = 40
      const total = shots.reduce((a, s) => a + (Number(s.duration_f) || 0), 0) || 1
      let x = 0
      return h('svg', { className: 'cfw-svg', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', style: { height: '38px' } },
        shots.map((s, i) => {
          const w = (Number(s.duration_f) || 0) / total * W
          const r = h('rect', { key: i, x, y: 6, width: Math.max(1, w - 1), height: 20, rx: 2, fill: i === shots.length - 1 ? 'var(--cf-accent)' : 'var(--cf-track)', opacity: i === shots.length - 1 ? '.55' : '1' })
          x += w
          return r
        }),
        shots.map((s, i) => {
          const w = (Number(s.duration_f) || 0) / total * W
          const cx = x - w / 2
          return h('text', { key: 's' + i, x: Math.max(0, cx - w / 2 + 6), y: 34, fontSize: '9', fill: 'var(--cf-faint)', fontFamily: 'ui-monospace,monospace' }, 'S' + String(i + 1).padStart(2, '0'))
        })
      )
    }

    function ShotCard(props) {
      const { shot, index, selected, onSelect, onDragStart, onDragOver, onDrop, onDragEnd, onResize, dragging, over, draggable } = props
      const onToggleLock = props.onToggleLock
      const hasPoster = props.hasPoster
      const dur = (Number(shot.duration_f) || 0) / (Number(props.fps) || 30)
      const locked = Array.isArray(shot.locked) && shot.locked.length
      return h('article', {
        className: 'cfw-shot' + (selected ? ' sel' : '') + (dragging ? ' dragging' : '') + (over ? ' over' : ''),
        onClick: onSelect,
        title: (shot.card_id || '') + (draggable === false ? ' —— 已放行，分镜已锁' : ' —— 拖动可重排，拖右边缘改时长'),
        draggable: draggable !== false,
        onDragStart: onDragStart,
        onDragOver: onDragOver,
        onDrop: onDrop,
        onDragEnd: onDragEnd,
      },
        h('div', { className: 'cfw-thumb' },
          hasPoster ? h(Thumb, { src: posterUrl(shot.card_id), alt: shot.card_id }) : h('div', { className: 'nopv' }, '无预览', h('br'), shot.card_id || '未命名'),
          h('span', { className: 'dur' }, fmtDur(dur)),
          onToggleLock ? h('span', {
            className: 'lk' + (locked ? '' : ' off'),
            title: locked ? '已锁定：AI 重跑这一镜时不会覆盖它（点一下解锁）' : '点一下锁定这一镜：AI 自动重跑时跳过它',
            onClick: (e) => { e.stopPropagation(); e.preventDefault(); onToggleLock(index) },
            onMouseDown: (e) => e.stopPropagation(),
          }, 'L') : (locked ? h('span', { className: 'lk', title: '这一镜被锁定' }, 'L') : null),
          onResize ? h('span', {
            className: 'rz', title: '向右拖长 / 向左缩短', draggable: false,
            onMouseDown: (e) => { e.stopPropagation(); onResize(e) },
            onClick: (e) => e.stopPropagation(),
          }) : null
        ),
        h('div', { className: 'cfw-sb' },
          h('div', { className: 'cfw-sh' }, h('span', { className: 'cfw-sno' }, 'S' + String(index + 1).padStart(2, '0')), h('span', { className: 'cfw-snm' }, shot.card_id || '—')),
          h('div', { className: 'cfw-sintent' }, shot.intent || shot.summary || ''),
          h('div', { className: 'cfw-smeta' },
            shot.category ? h('span', { className: 'cfw-tag' }, CAT_CN[shot.category] || shot.category) : null,
            shot.energy ? h('span', { className: 'cfw-tag e' }, ENERGY_CN[shot.energy] || shot.energy) : null,
            shot.transition_in ? h('span', { className: 'cfw-tag' }, '入 ' + shot.transition_in) : null
          )
        )
      )
    }

    function SectionB(props) {
      const { project, state, setState, lint, busy, gateOpen, locked } = props
      const onToggleLock = props.onToggleLock
      const onEditShot = props.onEditShot
      const shots = (project && Array.isArray(project.shots)) ? project.shots : []
      const p = (project && project.project) || {}
      const fps = Number(p.fps) || 30
      const totalF = shots.reduce((a, s) => a + (Number(s.duration_f) || 0), 0)
      const cardMap = props.cardMap || {}
      const sel = state.sel
      const animatic = (project && project.animatic) || null
      const drag = state.drag || null
      const onChangeShots = props.onChangeShots
      const onResizeStart = props.onResizeStart
      if (!shots.length) {
        return h('section', { className: 'cfw-col' },
          h('div', { className: 'cfw-ph' }, h('b', null, 'B · 分镜板'), h('s', null, '还没有分镜')),
          h('div', { className: 'cfw-sc' },
            h('div', { className: 'cfw-hint' }, '这个工程还没有分镜。回到对话里说「开始做分镜」，导演会按 11 阶段流水线产出分镜并等你拍板。')
          )
        )
      }
      const animaUrl = animatic && animatic.mp4 ? API + '/asset?src=workspace&id=' + encodeURIComponent((state.name || '') + '/' + animatic.mp4) + '&v=' + encodeURIComponent(String(project.rev || 0)) : ''
      const move = (from, to) => {
        if (from === to || from == null || to == null) return
        const next = shots.slice()
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        onChangeShots(reflowShots(next, fps))
      }
      // 从右侧镜头库拖进来的卡：拖到某一镜上 = 替换，拖到空白 = 末尾追加。
      const putCard = (cardId, at) => {
        if (!cardId) return
        const card = cardMap[cardId] || {}
        const base0 = {
          card_id: cardId,
          category: card.category || '',
          intent: card.summary || '',
          duration_f: 90,
          energy: 'mid',
        }
        const next = shots.slice()
        if (at == null || at >= next.length) next.push(base0)
        else next[at] = Object.assign({}, next[at], base0)
        onChangeShots(reflowShots(next, fps))
        props.toast && props.toast('已' + (at == null || at >= shots.length ? '追加' : '替换 S' + String(at + 1).padStart(2, '0')) + '：' + cardId)
      }
      return h('section', { className: 'cfw-col' },
        h('div', { className: 'cfw-ph' },
          h('b', null, 'B · 分镜板'),
          h('s', null, shots.length + ' 镜 · ' + fmtDur(totalF / fps) + ' · ' + fps + 'fps'),
          h('div', { className: 'cfw-sp' }),
          h('s', { style: { whiteSpace: 'nowrap' } }, locked ? '已放行 · 分镜已锁' : (drag ? '丢到目标镜上完成重排' : '拖动重排 · 拖右边缘改时长'))
        ),
        h('div', { className: 'cfw-sc' },
          h('div', {
            className: 'cfw-board',
            onDragOver: (e) => { if (!locked && state.dragCard) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } },
            onDrop: (e) => {
              if (locked || !state.dragCard) return
              e.preventDefault()
              putCard(state.dragCard, null)
              props.onCardDragEnd && props.onCardDragEnd()
            },
          },
            shots.map((s, i) => {
              const card = cardMap[s.card_id]
              return h(ShotCard, {
                key: s.id || i,
                shot: s,
                index: i,
                fps,
                selected: sel === i,
                hasPoster: !!(card && card.has_poster),
                dragging: !!(drag && drag.from === i),
                over: !!(drag && drag.over === i && drag.from !== i),
                onSelect: () => setState((st) => Object.assign({}, st, { sel: sel === i ? null : i })),
                draggable: !locked,
                onDragStart: (e) => {
                  if (locked) { e.preventDefault(); return }
                  try { e.dataTransfer.setData('text/cfw-shot', String(i)); e.dataTransfer.effectAllowed = 'move' } catch (_) {}
                  setState((st) => Object.assign({}, st, { drag: { from: i, over: null } }))
                },
                onDragOver: (e) => {
                  if (state.dragCard) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return }
                  if (!drag) return
                  e.preventDefault()
                  if (drag.over !== i) setState((st) => Object.assign({}, st, { drag: { from: drag.from, over: i } }))
                },
                onDrop: (e) => {
                  e.preventDefault()
                  if (state.dragCard) { putCard(state.dragCard, i); props.onCardDragEnd && props.onCardDragEnd(); return }
                  const from = drag ? drag.from : Number(e.dataTransfer.getData('text/cfw-shot'))
                  move(from, i)
                  setState((st) => Object.assign({}, st, { drag: null }))
                },
                onDragEnd: () => setState((st) => Object.assign({}, st, { drag: null })),
                onResize: locked ? null : (e) => onResizeStart && onResizeStart(i, e),
                onToggleLock: onToggleLock,
              })
            })
          ),
          sel !== null && shots[sel] ? h('div', { className: 'cfw-editor' },
            h('div', { className: 'hd' },
              h('b', null, 'S' + String(sel + 1).padStart(2, '0') + ' · ' + (shots[sel].card_id || '—')),
              h('s', null, locked ? '已放行，要改下镜先撤回放行' : '改这一镜，不动其它镜'),
              h('div', { className: 'cfw-sp' }),
              h('button', {
                type: 'button', className: 'cfw-btn mini',
                disabled: locked,
                title: '把这一镜恢复成镜头卡的建议（时长/能量/意图），不影响其它镜',
                onClick: () => onEditShot && onEditShot(sel, { duration_f: 90, energy: (cardMap[shots[sel].card_id] || {}).energy || 'mid', intent: (cardMap[shots[sel].card_id] || {}).summary || '' }),
              }, '重置为 AI 建议')
            ),
            h('div', { className: 'cfw-grid2' },
              h('label', { className: 'cfw-mini' }, '时长（帧 · ' + fps + 'fps）',
                h('input', {
                  className: 'cfw-in', type: 'number', min: 15, max: 900, step: 1,
                  value: Number(shots[sel].duration_f) || 0, disabled: locked,
                  onChange: (e) => onEditShot && onEditShot(sel, { duration_f: Math.max(15, Math.min(900, Math.round(Number(e.target.value) || 15))) }),
                })
              ),
              h('label', { className: 'cfw-mini' }, '能量',
                h('select', {
                  className: 'cfw-in', value: shots[sel].energy || 'mid', disabled: locked,
                  onChange: (e) => onEditShot && onEditShot(sel, { energy: e.target.value }),
                }, ['low', 'mid', 'mid-high', 'high', 'peak'].map((k) => h('option', { key: k, value: k }, ENERGY_CN[k] || k)))
              )
            ),
            h('label', { className: 'cfw-mini' }, '这一镜要表达什么（会进分镜表，不会直接变成字幕）',
              h('textarea', {
                className: 'cfw-in', rows: 2, value: shots[sel].intent || '', disabled: locked,
                onChange: (e) => onEditShot && onEditShot(sel, { intent: e.target.value }),
              })
            ),
            h('div', { className: 'cfw-hint' }, '带 L 的镜头被锁定：AI 自动重跑这一镜时会跳过它。锁的是这一镜，不是整份分镜。')
          ) : null,

          h('div', { className: 'cfw-sec' }, h('h4', null, '能量曲线', h('em', null, '虚线 = 目标弧线 · 实线 = 当前分镜')), h(EnergyCurve, { shots })),
          h('div', { className: 'cfw-sec' }, h('h4', null, '帧级时间轴', h('em', null, totalF + ' 帧')), h(Strip, { shots })),
          h('div', { className: 'cfw-sec' },
            h('h4', null, 'ANIMATIC', h('em', null, '低分辨率 · 时间线真实'),
              h('button', {
                type: 'button', className: 'cfw-btn', disabled: busy,
                style: { textTransform: 'none', letterSpacing: 0, fontWeight: 400, padding: '1px 8px', fontSize: '11px' },
                title: '按当前分镜重排预览片，约 3 秒',
                onClick: () => props.onAnimatic && props.onAnimatic(),
              }, busy ? '生成中…' : (animatic ? '重新生成' : '生成预览'))
            ),
            h('div', { className: 'cfw-anim' },
              h('div', { className: 'cfw-phone' },
                animaUrl ? h('video', { src: animaUrl, controls: true, preload: 'metadata' }) : h('div', { className: 'nopv', style: { padding: '20px 8px', fontSize: '10px', color: 'var(--cf-faint)', textAlign: 'center' } }, '尚未生成', h('br'), '分镜确认后生成'),
                h('span', { className: 'tag' }, '预览 · 非最终')
              ),
              h('div', { className: 'cfw-facts' },
                h('div', null, h('b', null, sel !== null && shots[sel] ? 'S' + String(sel + 1).padStart(2, '0') + ' ' + shots[sel].card_id : '未选镜头'), sel !== null && shots[sel] ? ' · ' + fmtDur((Number(shots[sel].duration_f) || 0) / fps) + ' · ' + (Number(shots[sel].duration_f) || 0) + 'f' : ''),
                h('div', null, 'BGM ', h('b', null, (project.audio && project.audio.bgm && project.audio.bgm.bpm) ? project.audio.bgm.bpm + ' BPM' : '—')),
                h('div', null, 'SFX ', h('b', null, ((project.audio && project.audio.sfx) || []).length + ' 条')),
                h('div', null, '拍点 ', h('b', null, ((project.audio && project.audio.bgm && project.audio.bgm.hit_list) || []).length + ' 处')),
                h('div', { className: 'cfw-hint', style: { marginTop: '6px' } }, '改分镜后重新生成，约 10 秒看到新节奏 —— 改的是分镜，不是像素。')
              )
            )
          ),
          h(LintPanel, { result: lint }),
          h('div', { className: 'cfw-gate' },
            h('span', { className: 'dot' + (gateOpen ? '' : ' off') }),
            h('p', null, gateOpen
              ? '已放行（' + (project.gates && project.gates.storyboard && project.gates.storyboard.at || '').slice(0, 19).replace('T', ' ') + '）· 画幅与时长已锁定，要改先撤回。'
              : '分镜就绪：' + shots.length + ' 镜全部配卡。放行后进入素材采集，画幅与时长锁定。'),
            h('button', {
              type: 'button',
              className: 'cfw-btn' + (gateOpen ? '' : ' pri'),
              disabled: busy || (!gateOpen && lint && lint.summary && lint.summary.errors > 0),
              title: !gateOpen && lint && lint.summary && lint.summary.errors > 0 ? '有 error 级问题，先修完才能放行' : (gateOpen ? '撤回放行，回到可改分镜的状态' : '确认分镜，进入素材采集'),
              onClick: () => props.onGate(!gateOpen),
            }, busy ? '处理中…' : (gateOpen ? '撤回放行' : '确认放行 →'))
          )
        )
      )
    }

    // ── C 区：资源库 ───────────────────────────────────────────────────
    function SectionC(props) {
      const { cards, templates, state, setState, locked } = props
      const onCardDrag = props.onCardDrag || function () {}
      const onCardDragEnd = props.onCardDragEnd || function () {}
      const tab = state.ctab || 'cards'
      const q = state.q || ''
      const cat = state.cat || ''
      const list = (cards || []).filter((c) => (!cat || c.category === cat) && (!q || (c.id + ' ' + (c.summary || '') + ' ' + (c.tags || []).join(' ')).toLowerCase().indexOf(q.toLowerCase()) >= 0))
      const counts = {}
      for (const c of cards || []) counts[c.category] = (counts[c.category] || 0) + 1
      return h('section', { className: 'cfw-col' },
        h('div', { className: 'cfw-ph' },
          h('b', null, 'C · 资源库'),
          h('span', { className: 'cfw-sp' }),
          h('s', null, (cards || []).length + ' 卡 · ' + ((templates && templates.templates) || []).length + ' 模板')
        ),
        h('div', { className: 'cfw-tabs' },
          h('button', { type: 'button', className: 'cfw-tab' + (tab === 'cards' ? ' on' : ''), onClick: () => setState((s) => Object.assign({}, s, { ctab: 'cards' })) }, '镜头库 ' + (cards || []).length),
          h('button', { type: 'button', className: 'cfw-tab' + (tab === 'tpl' ? ' on' : ''), onClick: () => setState((s) => Object.assign({}, s, { ctab: 'tpl' })) }, '模板 ' + ((templates && templates.templates) || []).length)
        ),
        h('div', { className: 'cfw-sc' },
          tab === 'cards' ? h('div', null,
            h('input', {
              className: 'cfw-search',
              placeholder: '搜索卡片 / 标签 / 意图',
              value: q,
              onChange: (e) => setState((s) => Object.assign({}, s, { q: e.target.value })),
            }),
            h('div', { className: 'cfw-cats' },
              h('button', { type: 'button', className: 'cfw-cat' + (cat === '' ? ' on' : ''), onClick: () => setState((s) => Object.assign({}, s, { cat: '' })) }, '全部'),
              Object.keys(CAT_CN).map((k) => h('button', {
                key: k, type: 'button', className: 'cfw-cat' + (cat === k ? ' on' : ''),
                onClick: () => setState((s) => Object.assign({}, s, { cat: cat === k ? '' : k })),
              }, CAT_CN[k], h('s', null, ' ' + (counts[k] || 0)))
            )),
            h('div', { className: 'cfw-lib' },
              list.slice(0, 60).map((c) => h('div', {
                key: c.id,
                className: 'cfw-lc' + (state.dragCard === c.id ? ' dragging' : ''),
                draggable: !locked,
                onDragStart: (e) => {
                  if (locked) { e.preventDefault(); return }
                  try { e.dataTransfer.setData('text/cfw-card', c.id); e.dataTransfer.effectAllowed = 'copy' } catch (_) {}
                  onCardDrag(c.id)
                },
                onDragEnd: () => onCardDragEnd(),
                title: (c.summary || '') + '\n' + (c.use || '') + (locked ? '\n分镜已放行，撤回放行后才能换卡' : '\n拖动到分镜板：末尾追加，丢到某镜上则替换该镜'),
              },
                h('div', { className: 'th' }, c.has_poster ? h(Thumb, { src: posterUrl(c.id), alt: c.id }) : '无图'),
                h('div', { style: { minWidth: 0 } },
                  h('div', { className: 'nm' }, c.summary || c.id),
                  h('div', { className: 'mt' }, (CAT_CN[c.category] || c.category) + ' · ' + (ENERGY_CN[c.energy] || c.energy || '—') + ' · ' + (c.duration || '—'))
                )
              )),
              list.length > 60 ? h('div', { className: 'cfw-hint' }, '还有 ' + (list.length - 60) + ' 张，输入关键词缩小范围') : null,
              !list.length ? h('div', { className: 'cfw-hint' }, '没有匹配的卡片') : null
            )
          ) : null,
          tab === 'tpl' ? h('div', null,
            ((templates && templates.templates) || []).length
              ? ((templates && templates.templates) || []).map((t) => h('div', { key: t.id, className: 'cfw-tplrow' },
                  h('b', null, t.name || t.id),
                  h('s', null, (t.structure && t.structure.shot_count ? t.structure.shot_count + ' 镜' : '') + (t.sound && t.sound.bpm ? ' · ' + Math.round(t.sound.bpm) + ' BPM' : ''))
                ))
              : h('div', { className: 'cfw-hint' }, '还没有模板。用 scripts/extract-template.mjs 从参考片提取一份。')
          ) : null
        )
      )
    }

    // ── 底栏 ──────────────────────────────────────────────────────────
    function BottomBar(props) {
      const { project, cardMap, verifyMeta, busy } = props
      const stage = stageIndex((project && project.stage) || '')
      const shots = (project && project.shots) || []
      const withCard = shots.filter((s) => s.card_id).length
      const frames = verifyMeta && verifyMeta.found ? String((verifyMeta.verify && verifyMeta.verify.frames || []).length) : (project && project.static_frames ? String(project.static_frames) : '—')
      const verBad = verifyMeta && verifyMeta.found && verifyMeta.verify && !verifyMeta.verify.ok
      return h('div', { className: 'cfw-bot' },
        h('div', { className: 'cfw-steps' },
          STAGES.map((s, i) => h('span', {
            key: s,
            className: 'cfw-step' + (i < stage ? ' done' : i === stage ? ' now' : ''),
          }, (i < stage ? '✓ ' : '') + s))
        ),
        h('div', { className: 'cfw-sp' }),
        h('span', { className: 'cfw-metric' }, '配卡 ', h('b', null, withCard + '/' + shots.length)),
        h('span', { className: 'cfw-metric' }, '静帧 ', h('b', { style: verBad ? { color: 'var(--cf-bad)' } : null }, frames)),
        h('button', {
          type: 'button', className: 'cfw-btn',
          title: verifyMeta && verifyMeta.found ? '看静帧与终检报告' : '还没有验收报告 —— 点开看怎么跑',
          onClick: () => props.onVerify && props.onVerify(),
        }, '静帧验收'),
        h('button', {
          type: 'button', className: 'cfw-btn pri', disabled: !!busy,
          title: '检查九项发布前置条件（不上传）',
          onClick: () => props.onPublish && props.onPublish(),
        }, '发布检查')
      )
    }

    // ── 空态 ──────────────────────────────────────────────────────────
    function EmptyState(props) {
      const { list, onCreate, onPick, error } = props
      const projects = (list && list.projects) || []
      return h('div', { className: 'cfw-sc', style: { padding: '26px 30px' } },
        h('div', { className: 'cfw-empty' },
          h('b', null, projects.length ? '选一个工程继续' : '工作区里还没有视频工程'),
          h('p', null, projects.length
            ? '每个工程 = 工作区里的一个文件夹，里面有 project.json。'
            : '让导演从一句 idea 起一个工程：回到对话里说「做一个 20 秒抖音片，讲讲 XXX」。'),
          projects.length ? h('div', { style: { width: '100%', maxWidth: '560px', marginTop: '8px' } },
            projects.map((p) => h('div', {
              key: p.name,
              className: 'cfw-lc',
              style: { marginBottom: '5px', gridTemplateColumns: 'minmax(0,1fr)' },
              onClick: () => onPick(p.name),
            },
              h('div', null,
                h('div', { className: 'nm' }, (p.title || p.name) + (p.broken ? ' · 文件损坏' : '')),
                h('div', { className: 'mt' }, [p.name, p.platform || '—', p.shot_count !== undefined ? p.shot_count + ' 镜' : '', 'rev ' + (p.rev || 0)].join(' · '))
              )
            ))
          ) : h('div', { className: 'cfw-code' }, '做一个 20 秒抖音片，讲讲「把散落的想法收进一张分镜板」这件事。\n目标观众：第一次听说这个工具的人。'),
          h('p', { style: { fontSize: '11px', color: 'var(--cf-faint)' } }, '也可以用 node scripts/compile-hf.mjs 直接渲染 examples/demo-project.json 看效果。'),
          error ? h('p', { style: { color: 'var(--cf-bad)' } }, error) : null
        )
      )
    }

    // ── 面板主体：状态机 + 数据加载 ────────────────────────────────────
    function WorkbenchPanel() {
      const [boot, setBoot] = useState({ phase: 'loading', error: '', list: null })
      const [state, setState] = useState({ name: '', tab: 'text', ctab: 'cards', q: '', cat: '', sel: null, tpl: '', mode: 'co', theme: 'dark', tplSaveName: '', tplSaveId: '', tplSaveLayers: ['style', 'structure', 'motion', 'sound'] })
      const [project, setProject] = useState(null)
      const [cards, setCards] = useState([])
      const [cardMap, setCardMap] = useState({})
      const [templates, setTemplates] = useState({ templates: [] })
      const [rev, setRev] = useState(0)
      const [saving, setSaving] = useState(false)
      const [dirty, setDirty] = useState(false)
      const [busy, setBusy] = useState(false)
      const [tplSaving, setTplSaving] = useState(false)
      const [lint, setLint] = useState(null)
      const [conflict, setConflict] = useState(null)
      const [toast, setToast] = useState(null)
      const [readOnly, setReadOnly] = useState(false)
      const [verifyMeta, setVerifyMeta] = useState(null)
      const [wall, setWall] = useState(null)      // {loading, data}
      const [publish, setPublish] = useState(null) // {loading, data}
      const [pubBusy, setPubBusy] = useState(false)
      const [themes, setThemes] = useState(null)   // /themes 的 token 表（4 套）
      const rootRef = useRef(null)
      const toastTimer = useRef(null)
      const revRef = useRef(0)      // 服务端最新 rev：保存时用它做 CAS
      const pendRef = useRef(null)  // 待保存的最新 project（连续拖动只发最后一次）
      const saveTimer = useRef(null)
      const savingRef = useRef(false)  // 一次只发一个保存请求，避免自己跟自己撞 409
      const againRef = useRef(false)   // 保存期间又改了 → 存完再补一次

      const say = useCallback((msg, bad) => {
        setToast({ msg, bad: !!bad })
        try { clearTimeout(toastTimer.current) } catch (e) {}
        toastTimer.current = setTimeout(() => setToast(null), bad ? 6000 : 2600)
      }, [])

      // 一次性加载：工程列表。工程为空就停在空态，不自动选。
      useEffect(() => {
        let alive = true
        api('/projects').then((r) => {
          if (!alive) return
          if (!r.ok) { setBoot({ phase: 'error', error: r.message || r.code || '工程列表读取失败', list: null }); return }
          const list = r
          const first = (list.projects || [])[0]
          setBoot({ phase: 'list', error: '', list })
          if (first && !first.broken) setState((s) => Object.assign({}, s, { name: first.name }))
        })
        api('/cards').then((r) => {
          if (!alive || !r.ok) return
          const arr = r.cards || []
          setCards(arr)
          const m = {}
          for (const c of arr) m[c.id] = { has_poster: !!c.preview_url || !!c.has_poster, category: c.category, summary: c.summary }
          setCardMap(m)
        })
        api('/templates').then((r) => { if (alive && r.ok) setTemplates(r) })
        api('/themes').then((r) => { if (alive && r.ok) setThemes(r) })
        return () => { alive = false }
      }, [])

      // 选中工程后加载 project.json
      useEffect(() => {
        if (!state.name) return
        let alive = true
        setProject(null)
        api('/project?name=' + encodeURIComponent(state.name)).then((r) => {
          if (!alive) return
          if (!r.ok) { setBoot({ phase: 'error', error: r.message || r.code || '读取工程失败', list: boot.list }); return }
          setProject(r.project)
          setRev(Number(r.rev) || 0)
          revRef.current = Number(r.rev) || 0
          setReadOnly(!!r.read_only)
          setDirty(false)
          setConflict(null)
          refreshLint(state.name)
          refreshVerify(state.name)
        })
        return () => { alive = false }
      }, [state.name])

      /** 拉一次体检结果（纯读，不写盘）。 */
      const refreshLint = useCallback((name) => {
        if (!name) return
        api('/lint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
          .then((r) => { if (r && r.ok) setLint(r) })
          .catch(() => {})
      }, [])

      /** 只读拉一次验收报告摘要（底部「静帧」计数与验收墙都用它）。 */
      const refreshVerify = useCallback((name) => {
        if (!name) return
        api('/verify?name=' + encodeURIComponent(name)).then((r) => { if (r && r.ok) setVerifyMeta(r) }).catch(() => {})
      }, [])

      /** 打开验收墙（每次都重拉，避免看到旧报告）。 */
      const openWall = useCallback(() => {
        const name = state.name
        if (!name) return
        setWall({ loading: true, data: null })
        api('/verify?name=' + encodeURIComponent(name)).then((r) => {
          setWall({ loading: false, data: r && r.ok ? r : { found: false, tried: [], hint: (r && r.message) || '读取失败' } })
        }).catch(() => setWall({ loading: false, data: { found: false, tried: [] } }))
      }, [state.name])

      /** 打开发布检查（服务端重算九项）。 */
      const openPublish = useCallback(() => {
        const name = state.name
        if (!name) return
        setPublish({ loading: true, data: null })
        api('/publish/preflight?name=' + encodeURIComponent(name)).then((r) => {
          setPublish({ loading: false, data: r && r.ok ? r : { preflight: null, error: (r && r.message) || '检查失败' } })
        }).catch(() => setPublish({ loading: false, data: { preflight: null, error: '网络错误' } }))
      }, [state.name])

      /** 记录发布回执（不代传）。 */
      const onRecord = useCallback((note) => {
        const name = state.name
        if (!name) return
        setPubBusy(true)
        api('/publish/record', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, note: note || '', baseRev: revRef.current }),
        }).then((r) => {
          setPubBusy(false)
          if (r && r.ok) {
            setPublish(null)
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setDirty(false)
            say('发布回执已记录（rev ' + r.rev + '）· 标识元数据 publish/aigc-metadata.json')
            refreshVerify(name)
            return
          }
          if (r && r.code === 'PREFLIGHT_BLOCKED') {
            setPublish({ loading: false, data: { preflight: r.preflight } })
            say('有 ' + ((r.preflight && r.preflight.counts && r.preflight.counts.blocking_failed) || 0) + ' 项必过项未通过', true)
            return
          }
          if (r && (r.code === 'CONFLICT' || r._status === 409)) {
            setPublish(null)
            setConflict({ currentRev: r.currentRev, current: r.current, mine: project, baseRev: revRef.current })
            return
          }
          say('记录失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setPubBusy(false); say('记录失败：网络错误', true) })
      }, [state.name, project, refreshVerify, say])

      /** 真发一次保存。baseRev 来自 revRef，409 就交给冲突面板。 */
      const doSave = useCallback((proj, baseRev) => {
        const name = state.name
        if (!name || !proj) return Promise.resolve()
        if (savingRef.current) { againRef.current = true; return Promise.resolve() }
        savingRef.current = true
        setSaving(true)
        return api('/project/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, project: proj, baseRev: baseRev }),
        }).then((r) => {
          savingRef.current = false
          setSaving(false)
          if (againRef.current) { againRef.current = false; setTimeout(() => { doSave(pendRef.current, revRef.current) }, 30) }
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            // 保存期间又改过 → 保持「未保存」，等补发那次存完再说
            if (!againRef.current) setDirty(false)
            refreshLint(name)
            return
          }
          if (r && (r.code === 'CONFLICT' || r._status === 409)) {
            setConflict({ currentRev: r.currentRev, current: r.current, mine: proj, baseRev })
            return
          }
          say('保存失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { savingRef.current = false; setSaving(false); say('保存失败：网络错误', true) })
      }, [state.name, refreshLint, say])

      /** 把一份新 project 立刻生效，并 500ms 防抖保存（连续拖动只发最后一次）。 */
      const applyLocal = useCallback((next) => {
        if (!next) return
        setProject(next)
        pendRef.current = next
        setDirty(true)
        try { clearTimeout(saveTimer.current) } catch (e) {}
        saveTimer.current = setTimeout(() => { doSave(pendRef.current, revRef.current) }, 500)
      }, [doSave])

      /** 改分镜（拖拽重排 / 拖卡进来）→ 立刻本地生效 → 防抖保存。 */
      const onChangeShots = useCallback((nextShots) => {
        if (!project) return
        applyLocal(Object.assign({}, project, { shots: nextShots }))
      }, [project, applyLocal])

      /** 主题循环：dark → light → ink → neon → dark（列表来自 /themes，加主题不用改这里）。 */
      const onTheme = useCallback(() => {
        setState((s) => {
          const list = (themes && themes.themes) || []
          const ids = list.length ? list.map((t) => t.id) : ['dark', 'light']
          const cur = ids.indexOf(s.theme || 'dark')
          return Object.assign({}, s, { theme: ids[(cur + 1) % ids.length] })
        })
      }, [themes])

      /**
       * 改简报字段。
       *
       * 「用户改过的字段」记进 brief_user_edited，不阻止 AI 重写，但让 AI 在重写前
       * 先看到这条标记（导演技能里会读它）。只做视觉标记与提示，不做保护 ——
       * 真正的保护是 locked（只用在分镜上）。
       */
      const onBrief = useCallback((k, val) => {
        if (!project) return
        const brief = Object.assign({}, project.brief || {}, { [k]: val })
        const edited = (project.brief_user_edited || []).slice()
        if (edited.indexOf(k) < 0) edited.push(k)
        applyLocal(Object.assign({}, project, { brief, brief_user_edited: edited }))
      }, [project, applyLocal])

      /** 切平台：画幅、时长上限、安全区一起变（预设来自 knowledge/platform-presets.json）。 */
      const onPlatform = useCallback((k) => {
        if (!project) return
        const preset = {
          douyin: { aspect: '9:16', duration_s: 30 },
          bilibili: { aspect: '16:9', duration_s: 90 },
          xiaohongshu: { aspect: '3:4', duration_s: 45 },
          wechat: { aspect: '9:16', duration_s: 60 },
          youtube: { aspect: '16:9', duration_s: 120 },
        }[k] || {}
        const pj = Object.assign({}, project.project || {}, { platform: k }, preset)
        applyLocal(Object.assign({}, project, { project: pj }))
        say('已切到 ' + (PLAT_CN[k] || k) + '：' + preset.aspect + ' · 建议 ' + fmtDur(preset.duration_s))
      }, [project, applyLocal, say])

      /** 填模板空位。空位没填满不允许进分镜（服务端 canEnterStoryboard 也拦）。 */
      const onSlot = useCallback((k, val) => {
        if (!project || !project.template) return
        const tpl = Object.assign({}, project.template)
        tpl.slots = Object.assign({}, tpl.slots || {}, { [k]: val })
        tpl.slots_complete = Object.keys(tpl.slots).every((x) => String(tpl.slots[x] || '').trim())
        applyLocal(Object.assign({}, project, { template: tpl }))
      }, [project, applyLocal])

      /** 套模板：服务端做「哪些层可覆盖」的判定，客户端只传选择。 */
      const onApplyTpl = useCallback((id, layers) => {
        const name = state.name
        if (!name || !id) return
        setBusy(true)
        api('/template/apply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, template_id: id, layers: layers, baseRev: revRef.current }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setDirty(false)
            api('/project?name=' + encodeURIComponent(name)).then((rr) => { if (rr && rr.ok) setProject(rr.project) })
            say('已套用「' + ((r.template && r.template.name) || id) + '」· ' + (r.applied || []).length + ' 层' + (r.slots_complete ? '' : ' · 空位还差 ' + (r.missing_slots || []).length + ' 项'))
            return
          }
          if (r && r.code === 'CONFLICT') { setConflict({ currentRev: r.currentRev, current: r.current, mine: project, baseRev: revRef.current }); return }
          say('套模板失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('套模板失败：网络错误', true) })
      }, [state.name, project, say])

      /** 存模板：服务端从 project.json 提模板 + 校验 + 落 knowledge/templates/。 */
      const onTplSave = useCallback(() => {
        const name = state.name
        if (!name) return
        setTplSaving(true)
        api('/template/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            title: (state.tplSaveName || '').trim() || undefined,
            id: (state.tplSaveId || '').trim() || undefined,
            layers: state.tplSaveLayers || undefined,
          }),
        }).then((r) => {
          setTplSaving(false)
          if (r && r.ok) {
            api('/templates').then((rr) => { if (rr && rr.ok) setTemplates(rr) })
            setState((st) => Object.assign({}, st, { tplSaveName: '', tplSaveId: '', tpl: r.id || st.tpl }))
            const warn = (r.warnings || []).length ? ' · ' + (r.warnings || []).length + ' 条提醒' : ''
            say('已存为模板「' + ((r.template && r.template.name) || r.id) + '」· ' + r.file + warn)
            return
          }
          if (r && r.code === 'TEMPLATE_EXISTS') {
            if (window.confirm('模板库里已经有 ' + r.id + '，覆盖它？')) {
              setTplSaving(true)
              api('/template/save', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  name, overwrite: true,
                  title: (state.tplSaveName || '').trim() || undefined,
                  id: (state.tplSaveId || '').trim() || undefined,
                  layers: state.tplSaveLayers || undefined,
                }),
              }).then((r2) => {
                setTplSaving(false)
                if (r2 && r2.ok) { api('/templates').then((rr) => { if (rr && rr.ok) setTemplates(rr) }); say('已覆盖模板「' + r2.id + '」') }
                else say('存模板失败：' + ((r2 && (r2.message || r2.code)) || '未知错误'), true)
              }).catch(() => { setTplSaving(false); say('存模板失败：网络错误', true) })
            }
            return
          }
          const why = (r && (r.errors || []).join('；')) || (r && (r.message || r.code)) || '未知错误'
          say('存模板失败：' + why, true)
        }).catch(() => { setTplSaving(false); say('存模板失败：网络错误', true) })
      }, [state.name, state.tplSaveName, state.tplSaveId, state.tplSaveLayers, say])

      /** 导入参考片：服务端跑 ffmpeg 切镜 + 指纹，产物落工程 analysis/。 */
      const onAnalyze = useCallback((path) => {
        const name = state.name
        if (!name || !path) return
        setBusy(true)
        say('正在分析参考片，长片可能需要几十秒…')
        api('/reference/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, path, baseRev: revRef.current }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setDirty(false)
            api('/project?name=' + encodeURIComponent(name)).then((rr) => { if (rr && rr.ok) setProject(rr.project) })
            say('参考片已分析：' + ((r.shots || []).length) + ' 镜 · 指纹已存进工程')
            return
          }
          if (r && r.code === 'CONFLICT') { setConflict({ currentRev: r.currentRev, current: r.current, mine: project, baseRev: revRef.current }); return }
          say('分析失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('分析失败：网络错误', true) })
      }, [state.name, project, say])

      /** 删掉工程里的参考片引用（不动磁盘上的源文件）。 */
      const onClearRef = useCallback(() => {
        const name = state.name
        if (!name) return
        setBusy(true)
        api('/reference/clear', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, baseRev: revRef.current }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setDirty(false)
            setProject((cur) => { if (!cur) return cur; const n = Object.assign({}, cur); delete n.reference; return n })
            say('已删除参考片引用（源文件没动）')
            return
          }
          say('删除失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('删除失败：网络错误', true) })
      }, [state.name, say])

      /** GOAL 动作：start / pause / resume / interrupt / advance / disable。 */
      const onGoal = useCallback((action) => {
        const name = state.name
        if (!name) return
        setBusy(true)
        api('/goal', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, action, baseRev: revRef.current }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setDirty(false)
            api('/project?name=' + encodeURIComponent(name)).then((rr) => { if (rr && rr.ok) setProject(rr.project) })
            say('GOAL · ' + ((r.summary && r.summary.text) || action))
            return
          }
          if (r && r.code === 'NEED_CONFIRM') { say('越硬门需要手写确认，界面暂不提供 —— 请在对话里明确说一次', true); return }
          if (r && r.code === 'CONFLICT') { setConflict({ currentRev: r.currentRev, current: r.current, mine: project, baseRev: revRef.current }); return }
          say('GOAL 操作失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('GOAL 操作失败：网络错误', true) })
      }, [state.name, project, say])

      /**
       * 锁定 / 解锁一镜。
       *
       * 语义：locked 是路径数组（['*'] = 整镜）。一期只做整镜锁 —— 路径级锁定
       * 还没有对应的 AI 重跑粒度，做了也没有东西会读它。
       */
      const onToggleLock = useCallback((index) => {
        if (!project) return
        const shots = (project.shots || []).slice()
        const cur = shots[index]
        if (!cur) return
        const has = Array.isArray(cur.locked) && cur.locked.length
        shots[index] = Object.assign({}, cur, { locked: has ? [] : ['*'] })
        applyLocal(Object.assign({}, project, { shots }))
        say(has ? ('S' + String(index + 1).padStart(2, '0') + ' 已解锁') : ('S' + String(index + 1).padStart(2, '0') + ' 已锁定 · AI 重跑会跳过它'))
      }, [project, applyLocal, say])

      /** 改单镜字段（时长 / 能量 / 意图），顺带重排时间轴。 */
      const onEditShot = useCallback((index, patch) => {
        if (!project) return
        const shots = (project.shots || []).slice()
        if (!shots[index]) return
        const edited = (shots[index].user_edited || []).slice()
        Object.keys(patch).forEach((k) => { if (edited.indexOf(k) < 0) edited.push(k) })
        shots[index] = Object.assign({}, shots[index], patch, { user_edited: edited })
        const fps0 = Number((project.project || {}).fps) || 30
        applyLocal(Object.assign({}, project, { shots: reflowShots(shots, fps0) }))
      }, [project, applyLocal])


      // 主题：token 表由 /themes 提供，这里只负责写 data-theme + 生成覆盖样式。
      // 不加主题时什么都不用改（CSS 里已有 dark/light 两套兜底）。
      useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const list = (themes && themes.themes) || []
        const defId = (themes && themes.default) || 'dark'
        const id = state.theme || defId
        el.setAttribute('data-theme', id)
        applyThemeCss(list, defId)
      }, [state.theme, themes])

      // 未保存拦截：关标签页时浏览器自己弹；面板内返回对话时自己拦一次。
      // 只拦「真的没存下去」的状态 —— 存成功会 setDirty(false)，不会误拦。
      useEffect(() => {
        if (!dirty) return
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return '' }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
      }, [dirty])

      const onBack = useCallback(() => {
        if (dirty && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm('还有改动没保存完（约 0.5 秒内会重试）。确定离开工作台？')) return
        }
        try {
          const layout = typeof ctx !== 'undefined' && ctx && typeof ctx.get === 'function' ? ctx.get('layout', false) : undefined
          if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
        } catch (e) { /* 拿不到 layout 就静默 */ }
      }, [dirty])

      /** 拖右边缘改时长：pointer 直接换 duration_f，最小 15 帧（0.5s @30fps）。 */
      const onResizeStart = useCallback((index, ev) => {
        const startX = ev.clientX
        const shots0 = (project && project.shots) || []
        const startDur = Math.round(Number(shots0[index] && shots0[index].duration_f) || 90)
        const fps0 = Number(((project && project.project) || {}).fps) || 30
        // 一帧大约多少像素：整个分镜板宽 / 总帧数，给个下限免得高帧率拖不动
        const pxPerFrame = Math.max(0.6, 620 / Math.max(120, totalFrames(shots0)))
        let last = startDur
        const onMove = (e) => {
          const deltaF = Math.round((e.clientX - startX) / pxPerFrame)
          const next = Math.max(15, startDur + deltaF)
          if (next === last) return
          last = next
          const arr = (shots0 || []).slice()
          arr[index] = Object.assign({}, arr[index], { duration_f: next })
          applyLocal(Object.assign({}, project, { shots: reflowShots(arr, fps0) }))
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          document.body.style.userSelect = ''
        }
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }, [project, applyLocal])

      /** 确认放行 / 撤回放行。 */
      const onGate = useCallback((open) => {
        const name = state.name
        if (!name) return
        setBusy(true)
        api('/gate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, gate: 'storyboard', open: open, baseRev: revRef.current }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            revRef.current = Number(r.rev) || revRef.current
            setRev(Number(r.rev) || 0)
            setProject((cur) => cur ? Object.assign({}, cur, {
              stage: r.stage,
              gates: Object.assign({}, cur.gates || {}, { storyboard: { open: open, at: new Date().toISOString(), by: 'user' } }),
            }) : cur)
            say(open ? '已放行，进入素材采集' : '已撤回放行，可以继续改分镜')
            refreshLint(name)
            return
          }
          if (r && r.code === 'LINT_BLOCKED') {
            say('有 ' + ((r.findings || []).length) + ' 个 error 级问题，先修完才能放行', true)
            setLint((cur) => cur ? Object.assign({}, cur, { findings: (r.findings || []).concat((cur.findings || []).filter((x) => x.severity !== 'error')), summary: r.summary }) : cur)
            return
          }
          if (r && (r.code === 'CONFLICT' || r._status === 409)) {
            setConflict({ currentRev: r.currentRev, current: r.current, mine: project, baseRev: revRef.current })
            return
          }
          say('放行失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('放行失败：网络错误', true) })
      }, [state.name, project, refreshLint, say])

      /** 生成 animatic。服务端写工程目录，前端拿新 rev 再拉一次工程。 */
      const onAnimatic = useCallback(() => {
        const name = state.name
        if (!name) return
        setBusy(true)
        say('正在生成预览片，约 3 秒…')
        api('/animatic', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        }).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            say('预览片已更新：' + (r.animatic ? r.animatic.build_ms : '?') + ' ms')
            api('/project?name=' + encodeURIComponent(name)).then((rr) => {
              if (rr && rr.ok) { setProject(rr.project); setRev(Number(rr.rev) || 0); revRef.current = Number(rr.rev) || 0; setDirty(false) }
            })
            return
          }
          say('生成失败：' + ((r && (r.message || r.code)) || '未知错误'), true)
        }).catch(() => { setBusy(false); say('生成失败：网络错误', true) })
      }, [state.name, say])

      const onCopy = useCallback(() => {
        const p = (project && project.project) || {}
        const text = '继续推进 cineforge 工程 ' + (state.name || p.id || '') + '，从当前阶段（' + ((project && project.stage) || 'storyboard') + '）往下做，把关点按我们商量的来。'
        try { navigator.clipboard.writeText(text) } catch (e) { /* 剪贴板不可用就算了 */ }
      }, [project, state.name])

      // 主题显示名（顶栏 tooltip 用），不回读 CSS。
      const themeList = (themes && themes.themes) || []
      const themeCur = themeList.filter((t) => t && t.id === (state.theme || 'dark'))[0]
      const themeName = (themeCur && themeCur.name) || (state.theme || 'dark')

      if (boot.phase === 'loading') {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme, themeName, onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body', style: { gridTemplateColumns: '1fr' } }, h('div', { className: 'cfw-sc' }, h('div', { className: 'cfw-hint' }, '正在读工作区…')))
        )
      }
      if (boot.phase === 'error') {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme, themeName, onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-banner bad' }, '读取失败：' + boot.error, h('button', { type: 'button', className: 'x', onClick: () => setBoot({ phase: 'loading', error: '', list: null }) }, '重试')),
          h('div', { className: 'cfw-body' }, h(EmptyState, { list: boot.list, error: boot.error }))
        )
      }
      if (!state.name) {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme, themeName, onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body', style: { gridTemplateColumns: '1fr' } },
            h(EmptyState, { list: boot.list, onPick: (n) => setState((s) => Object.assign({}, s, { name: n })) })
          )
        )
      }
      if (!project) {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme, themeName, onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body' }, h('div', { className: 'cfw-sc' }, h('div', { className: 'cfw-hint' }, '正在读工程 ' + state.name + ' …')))
        )
      }

      const gateOpen = !!(project.gates && project.gates.storyboard && project.gates.storyboard.open)
      // 只读锁定：门已放行（stage ≥ assets）时，分镜结构字段不可改 —— 要改先撤回放行。
      // 这是「已锁的东西不许悄悄改」，UI 与服务端 lint 都按同一条规矩说话。
      const stageNow = stageIndex(project.stage || '')
      const locked = readOnly || (gateOpen && stageNow > 5)
      const canSaveTpl = !!(project && Array.isArray(project.shots) && project.shots.some((x) => x && x.card_id))
      return h('div', { className: 'cfw', ref: rootRef },
        h(TopBar, {
          state, project, saving, dirty,
          onTheme, themeName,
          onMode: (m) => setState((s) => Object.assign({}, s, { mode: m })),
          onBack, onCopy,
        }),
        h(GoalBar, { project, busy, onGoal }),
        h('div', { className: 'cfw-body' },
          h(SectionA, {
            project, cards, templates, state, setState, locked, busy,
            status: ((project.brief && project.brief.complete) ? '已齐' : '还差几项'),
            onBrief, onPlatform, onSlot, onApplyTpl, onAnalyze, onClearRef,
          }),
          h(SectionB, {
            onToggleLock, onEditShot,
            project, state, setState, cardMap,
            lint, busy, gateOpen, locked,
            onChangeShots,
            onResizeStart: locked ? null : onResizeStart,
            onGate,
            onAnimatic,
            onCardDragEnd: () => setState((st) => Object.assign({}, st, { dragCard: null })),
            toast: (m) => say(m),
          }),
          h(SectionC, {
            cards, templates, state, setState, locked,
            onCardDrag: (id) => setState((st) => Object.assign({}, st, { dragCard: id })),
            onCardDragEnd: () => setState((st) => Object.assign({}, st, { dragCard: null })),
          })
        ),
        h(BottomBar, { project, cardMap, verifyMeta, busy, onVerify: openWall, onPublish: openPublish }),
        h(Toast, { msg: toast && toast.msg, bad: toast && toast.bad }),
        wall ? h(VerifyWall, {
          data: wall.data, loading: wall.loading,
          onClose: () => setWall(null),
          onGoto: (t) => {
            // 点某张静帧 → 跳到覆盖该时刻的那一镜（时间尺与镜卡联动）
            const ss = (project.shots || [])
            let idx = 0
            for (let i = 0; i < ss.length; i++) {
              const st = (Number(ss[i].from) || 0) / (Number((project.project || {}).fps) || 30)
              const du = (Number(ss[i].duration_f) || 0) / (Number((project.project || {}).fps) || 30)
              if (t >= st && t < st + du) { idx = i; break }
            }
            setState((st) => Object.assign({}, st, { sel: idx }))
            setWall(null)
          },
        }) : null,
        publish ? h(PublishDialog, {
          data: publish.data, loading: publish.loading, busy: pubBusy,
          onClose: () => setPublish(null),
          onRecord: onRecord,
        }) : null,
        conflict ? h(ConflictPanel, {
          conflict: Object.assign({}, conflict, { baseRev: conflict.baseRev }),
          onClose: () => setConflict(null),
          onTakeTheirs: () => {
            const c = conflict
            setConflict(null)
            setProject(c.current)
            revRef.current = Number(c.currentRev) || revRef.current
            setRev(Number(c.currentRev) || 0)
            setDirty(false)
            say('已采用服务端版本 rev ' + c.currentRev)
          },
          onKeepMine: () => {
            const c = conflict
            setConflict(null)
            revRef.current = Number(c.currentRev) || revRef.current
            doSave(c.mine, Number(c.currentRev))
          },
        }) : null
      )
    }

    // ── 侧栏图标 ──────────────────────────────────────────────────────
    function SidebarIcon(owner) {
      const size = (owner && owner.size) || 16
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: '1.5', y: '3', width: '13', height: '10', rx: '2', stroke: 'currentColor', strokeWidth: '1.2' }),
        h('path', { d: 'M6 3v10M10.5 3v10', stroke: 'currentColor', strokeWidth: '1.1', opacity: '.55' }),
        h('circle', { cx: '8.2', cy: '8', r: '1.5', fill: 'currentColor', opacity: '.85' })
      )
    }

    // ── apply：成对注册槽位 ────────────────────────────────────────────
    function apply(ctx) {
      let offPanel, offRow
      try {
        const slots = ctx.slots
        if (!slots || typeof slots.inject !== 'function') return
        slots.inject('main', () => slots.inject('sidebar.panellist', () => {
          offPanel = slots.register({ name: 'main', key: PANEL_ID }, WorkbenchPanel)
          offRow = slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 42,
            label: () => M('影铸工作台', 'CineForge'),
            locale: 'cineforge',
          }, SidebarIcon)
          return () => {
            try { if (typeof offRow === 'function') offRow() } catch (e) {}
            try { if (typeof offPanel === 'function') offPanel() } catch (e) {}
          }
        }))
      } catch (e) {
        try { console.warn('[dsh-cineforge] slot register failed', e) } catch (e2) {}
      }
    }

    // ── 样式注入（幂等，卸载时移除）──────────────────────────────────
    function injectStyles() {
      if (typeof document === 'undefined') return () => {}
      const ID = 'dsh-cineforge-styles'
      if (document.getElementById(ID)) return () => {}
      const el = document.createElement('style')
      el.id = ID
      el.textContent = CSS_TEXT
      document.head.appendChild(el)
      return () => { try { el.remove() } catch (e) {} }
    }

    const name = 'cineforge-workbench'
    const inject = ['slots']
    exports.name = name
    exports.inject = inject
    exports.apply = function (ctx) {
      const off = injectStyles()
      try {
        apply(ctx)
      } catch (e) { try { console.warn('[dsh-cineforge] apply failed', e) } catch (e2) {} }
      if (ctx.effect) { try { ctx.effect(() => off) } catch (e) {} }
    }
    return module.exports
  },
})