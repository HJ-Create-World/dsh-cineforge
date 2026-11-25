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
    function Field(props) {
      const v = props.value
      const empty = v === undefined || v === null || v === ''
      return h('div', { className: 'cfw-f' },
        h('em', null, props.label),
        h('div', {
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

    // ── 顶栏 ──────────────────────────────────────────────────────────
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
        h('button', { type: 'button', className: 'cfw-ib', onClick: onTheme, title: '切换明暗主题' }, '◐'),
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
          tab === 'text' ? h(TextPanel, { project, brief, edited, setState }) : null,
          tab === 'video' ? h(VideoPanel, { project, state }) : null,
          tab === 'tpl' ? h(TplPanel, { templates, state, setState }) : null,
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
      return h('div', null,
        h('div', { className: 'cfw-lbl' }, '一句话 idea'),
        h(Field, { label: '这个片子要做什么', value: brief('idea'), placeholder: '还没写 —— 可以在对话里让导演补', userEdited: edited.indexOf('idea') >= 0 }),
        h(Field, { label: '给谁看', value: brief('audience'), placeholder: '例如：第一次听说这个产品的人' }),
        h(Field, { label: '想让 TA 做什么', value: brief('action'), placeholder: '例如：点进主页看完整演示' }),
        h(Field, { label: '一句话卖点', value: brief('pitch'), placeholder: '一句话说清「凭什么信」' }),
        h(Field, { label: '证据是什么', value: brief('evidence'), placeholder: '真实截图 / 数据 / 客户原话' }),
        h(Field, { label: '调性', value: brief('tone'), placeholder: '例如：克制、纸墨感、不喊口号' }),
        h('div', { className: 'cfw-lbl' }, '平台与画幅'),
        h('div', { className: 'cfw-chiprow' },
          Object.keys(PLAT_CN).map((k) => h(Chip, { key: k, label: PLAT_CN[k], on: platform === k, title: '画幅与时长按平台预设联动' }))
        ),
        h('div', { className: 'cfw-row2', style: { marginTop: '8px' } },
          h(Field, { label: '画幅', value: (p.aspect || pr[0]) }),
          h(Field, { label: '时长', value: fmtDur(p.duration_s) + (p.fps ? ' · ' + p.fps + 'fps' : '') })
        ),
        h('div', { className: 'cfw-hint warn' }, '竖屏片底部 20% 会被抖音 UI 遮挡，字幕与关键信息不要放进去。')
      )
    }

    function VideoPanel(props) {
      const { project, state } = props
      const ref = (project && project.reference) || null
      if (!ref) {
        return h('div', null,
          h('div', { className: 'cfw-hint' }, '还没有参考片。在对话里把视频路径发给导演（例如「用这段片子当模板：@D:\\\\clips\\\\ref.mp4」），或运行 node scripts/analyze.mjs video <路径>。'),
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
      const pal = (fp.palette && fp.palette.colors) || []
      const tone = fp.tone || {}
      const mo = fp.motion || {}
      const rh = fp.rhythm || {}
      return h('div', null,
        h('div', { className: 'cfw-f' },
          h('em', null, '参考片'),
          h('div', { className: 'cfw-val' }, (ref.file || 'reference.mp4') + ' · ' + [ref.width, ref.height].filter(Boolean).join('×') + ' · ' + fmtDur(ref.duration_s) + (ref.fps ? ' · ' + Math.round(ref.fps) + 'fps' : ''))
        ),
        h('div', { className: 'cfw-lbl' }, '风格指纹'),
        h('div', { className: 'cfw-facts' },
          h('div', null, h('b', null, '调色板 '), pal.length + ' 色'),
          h('div', { className: 'cfw-chiprow', style: { margin: '3px 0 6px' } },
            pal.slice(0, 6).map((c, i) => h('span', {
              key: i,
              title: (c.hex || c.color) + ' · ' + Math.round((c.share || 0) * 100) + '%',
              style: { width: '18px', height: '18px', borderRadius: '3px', background: c.hex || c.color, border: '1px solid var(--cf-line2)', display: 'inline-block' },
            }))
          ),
          h('div', null, h('b', null, '明暗 '), '暗 ' + (tone.dark !== undefined ? tone.dark : '—') + ' · 中 ' + (tone.mid !== undefined ? tone.mid : '—') + ' · 亮 ' + (tone.light !== undefined ? tone.light : '—')),
          h('div', null, h('b', null, '运动 '), '静态 ' + (mo.static_ratio !== undefined ? Math.round(mo.static_ratio * 100) + '%' : '—') + ' · p90 ' + (mo.p90 !== undefined ? mo.p90 : '—') + ' · p99 ' + (mo.p99 !== undefined ? mo.p99 : '—')),
          h('div', null, h('b', null, '节奏 '), (rh.bpm ? '≈' + rh.bpm + ' BPM' : '无音轨') + (rh.bpm_stability && rh.bpm_stability.spread_bpm !== undefined ? ' · 段间差 ' + rh.bpm_stability.spread_bpm : ''))
        ),
        ref.shots && ref.shots.length ? h('div', { className: 'cfw-lbl' }, '已切 ' + ref.shots.length + ' 镜') : null,
        ref.shots && ref.shots.length ? h('div', { className: 'cfw-leg' },
          h('span', null, '中位 ' + fmtDur(ref.shots.map((s) => s.duration_s).sort((a, b) => a - b)[Math.floor(ref.shots.length / 2)])),
          h('span', null, '总长 ' + fmtDur(ref.duration_s))
        ) : null,
        h('div', { className: 'cfw-hint' }, '参考片只用来提取「怎么拍」，不复制画面内容。指纹存进工程后可以随时删掉源视频。')
      )
    }

    function TplPanel(props) {
      const { templates, state, setState } = props
      const list = (templates && templates.templates) || []
      const sel = state.tpl || ''
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
        h('div', { className: 'cfw-lbl' }, '复用哪几层'),
        h('div', { className: 'cfw-chiprow' },
          ['视觉风格', '分镜结构', '动效配方', '声音设计', '文案骨架'].map((x, i) =>
            h(Chip, { key: x, label: x, on: i < 4 })
          )
        ),
        h('div', { className: 'cfw-hint' }, '模板只存「怎么拍」，不存「拍什么」。套模板后文案仍要重写。')
      )
    }

    function Gates(props) {
      const { project, state, setState } = props
      const rows = [
        ['分镜确认', '硬门', true],
        ['文案', '软门', true],
        ['视觉方向', '软门', true],
        ['静帧验收', '软门', false],
      ]
      return h('div', { className: 'cfw-gates' },
        h('div', { className: 'cfw-lbl', style: { marginTop: 0 } }, '把关点'),
        rows.map(([label, kind, done]) => h('div', { key: label, className: 'cfw-gr' },
          h('span', { className: 'bx' + (done ? ' on' : '') }, done ? '✓' : ''),
          label,
          h('s', null, kind + (done ? ' · 已通过' : ' · 待定'))
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
      const { shot, index, selected, onSelect } = props
      const hasPoster = props.hasPoster
      const dur = (Number(shot.duration_f) || 0) / (Number(props.fps) || 30)
      const locked = Array.isArray(shot.locked) && shot.locked.length
      return h('article', { className: 'cfw-shot' + (selected ? ' sel' : ''), onClick: onSelect, title: shot.card_id || '' },
        h('div', { className: 'cfw-thumb' },
          hasPoster ? h(Thumb, { src: posterUrl(shot.card_id), alt: shot.card_id }) : h('div', { className: 'nopv' }, '无预览', h('br'), shot.card_id || '未命名'),
          h('span', { className: 'dur' }, fmtDur(dur)),
          locked ? h('span', { className: 'lk', title: '这一镜被锁定，AI 不会覆盖' }, 'L') : null
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
      const { project, state, setState } = props
      const shots = (project && Array.isArray(project.shots)) ? project.shots : []
      const p = (project && project.project) || {}
      const fps = Number(p.fps) || 30
      const totalF = shots.reduce((a, s) => a + (Number(s.duration_f) || 0), 0)
      const cardMap = props.cardMap || {}
      const sel = state.sel
      const animatic = (project && project.animatic) || null
      if (!shots.length) {
        return h('section', { className: 'cfw-col' },
          h('div', { className: 'cfw-ph' }, h('b', null, 'B · 分镜板'), h('s', null, '还没有分镜')),
          h('div', { className: 'cfw-sc' },
            h('div', { className: 'cfw-hint' }, '这个工程还没有分镜。回到对话里说「开始做分镜」，导演会按 11 阶段流水线产出分镜并等你拍板。')
          )
        )
      }
      const animaUrl = animatic && animatic.mp4 ? API + '/asset?src=workspace&id=' + encodeURIComponent((state.name || '') + '/' + animatic.mp4) : ''
      return h('section', { className: 'cfw-col' },
        h('div', { className: 'cfw-ph' },
          h('b', null, 'B · 分镜板'),
          h('s', null, shots.length + ' 镜 · ' + fmtDur(totalF / fps) + ' · ' + fps + 'fps'),
          h('div', { className: 'cfw-sp' }),
          h('s', { style: { whiteSpace: 'nowrap' } }, '带 L 的镜头 AI 不会覆盖')
        ),
        h('div', { className: 'cfw-sc' },
          h('div', { className: 'cfw-board' },
            shots.map((s, i) => {
              const card = cardMap[s.card_id]
              return h(ShotCard, {
                key: s.id || i,
                shot: s,
                index: i,
                fps,
                selected: sel === i,
                hasPoster: !!(card && card.has_poster),
                onSelect: () => setState((st) => Object.assign({}, st, { sel: sel === i ? null : i })),
              })
            })
          ),
          h('div', { className: 'cfw-sec' }, h('h4', null, '能量曲线', h('em', null, '虚线 = 目标弧线 · 实线 = 当前分镜')), h(EnergyCurve, { shots })),
          h('div', { className: 'cfw-sec' }, h('h4', null, '帧级时间轴', h('em', null, totalF + ' 帧')), h(Strip, { shots })),
          h('div', { className: 'cfw-sec' },
            h('h4', null, 'ANIMATIC', h('em', null, '低分辨率 · 时间线真实')),
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
          h('div', { className: 'cfw-gate' },
            h('span', { className: 'dot' }),
            h('p', null, '分镜已就绪：' + shots.length + ' 镜全部配卡。放行后进入素材采集，画幅与时长锁定。'),
            h('button', { type: 'button', className: 'cfw-btn pri', disabled: true, title: '0.4.x 只读：确认放行在 0.4.1 打开' }, '确认放行 →')
          )
        )
      )
    }

    // ── C 区：资源库 ───────────────────────────────────────────────────
    function SectionC(props) {
      const { cards, templates, state, setState } = props
      const tab = state.ctab || 'cards'
      const q = state.q || ''
      const cat = state.cat || ''
      const list = (cards || []).filter((c) => (!cat || c.category === cat) && (!q || (c.id + ' ' + (c.summary || '') + ' ' + (c.tags || []).join(' ')).toLowerCase().indexOf(q.toLowerCase()) >= 0))
      const counts = {}
      for (const c of cards || []) counts[c.category] = (counts[c.category] || 0) + 1
      return h('section', { className: 'cfw-col' },
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
              list.slice(0, 60).map((c) => h('div', { key: c.id, className: 'cfw-lc', title: (c.summary || '') + '\n' + (c.use || '') },
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
      const { project, cardMap } = props
      const stage = stageIndex((project && project.stage) || '')
      const shots = (project && project.shots) || []
      const withCard = shots.filter((s) => s.card_id).length
      return h('div', { className: 'cfw-bot' },
        h('div', { className: 'cfw-steps' },
          STAGES.map((s, i) => h('span', {
            key: s,
            className: 'cfw-step' + (i < stage ? ' done' : i === stage ? ' now' : ''),
          }, (i < stage ? '✓ ' : '') + s))
        ),
        h('div', { className: 'cfw-sp' }),
        h('span', { className: 'cfw-metric' }, '配卡 ', h('b', null, withCard + '/' + shots.length)),
        h('span', { className: 'cfw-metric' }, '静帧 ', h('b', null, (project && project.static_frames ? String(project.static_frames) : '—'))),
        h('button', { type: 'button', className: 'cfw-btn', disabled: true, title: '0.4.x 只读' }, '导出'),
        h('button', { type: 'button', className: 'cfw-btn pri', disabled: true, title: '0.4.x 只读' }, '渲染')
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
      const [state, setState] = useState({ name: '', tab: 'text', ctab: 'cards', q: '', cat: '', sel: null, tpl: '', mode: 'co', theme: 'dark' })
      const [project, setProject] = useState(null)
      const [cards, setCards] = useState([])
      const [cardMap, setCardMap] = useState({})
      const [templates, setTemplates] = useState({ templates: [] })
      const rootRef = useRef(null)

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
        })
        return () => { alive = false }
      }, [state.name])

      // 主题切换写到面板根节点，不污染宿主
      useEffect(() => {
        const el = rootRef.current
        if (!el) return
        if (state.theme === 'light') el.setAttribute('data-theme', 'light')
        else el.removeAttribute('data-theme')
      }, [state.theme])

      const onBack = useCallback(() => {
        try {
          const layout = typeof ctx !== 'undefined' && ctx && typeof ctx.get === 'function' ? ctx.get('layout', false) : undefined
          if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
        } catch (e) { /* 拿不到 layout 就静默 */ }
      }, [])

      const onCopy = useCallback(() => {
        const p = (project && project.project) || {}
        const text = '继续推进 cineforge 工程 ' + (state.name || p.id || '') + '，从当前阶段（' + ((project && project.stage) || 'storyboard') + '）往下做，把关点按我们商量的来。'
        try { navigator.clipboard.writeText(text) } catch (e) { /* 剪贴板不可用就算了 */ }
      }, [project, state.name])

      if (boot.phase === 'loading') {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme: () => setState((s) => Object.assign({}, s, { theme: s.theme === 'dark' ? 'light' : 'dark' })), onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body', style: { gridTemplateColumns: '1fr' } }, h('div', { className: 'cfw-sc' }, h('div', { className: 'cfw-hint' }, '正在读工作区…')))
        )
      }
      if (boot.phase === 'error') {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme: () => setState((s) => Object.assign({}, s, { theme: s.theme === 'dark' ? 'light' : 'dark' })), onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-banner bad' }, '读取失败：' + boot.error, h('button', { type: 'button', className: 'x', onClick: () => setBoot({ phase: 'loading', error: '', list: null }) }, '重试')),
          h('div', { className: 'cfw-body' }, h(EmptyState, { list: boot.list, error: boot.error }))
        )
      }
      if (!state.name) {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme: () => setState((s) => Object.assign({}, s, { theme: s.theme === 'dark' ? 'light' : 'dark' })), onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body', style: { gridTemplateColumns: '1fr' } },
            h(EmptyState, { list: boot.list, onPick: (n) => setState((s) => Object.assign({}, s, { name: n })) })
          )
        )
      }
      if (!project) {
        return h('div', { className: 'cfw', ref: rootRef },
          h(TopBar, { state, onTheme: () => setState((s) => Object.assign({}, s, { theme: s.theme === 'dark' ? 'light' : 'dark' })), onBack, project: null, saving: false, dirty: false, onMode: () => {}, onCopy: () => {} }),
          h('div', { className: 'cfw-body' }, h('div', { className: 'cfw-sc' }, h('div', { className: 'cfw-hint' }, '正在读工程 ' + state.name + ' …')))
        )
      }

      return h('div', { className: 'cfw', ref: rootRef },
        h(TopBar, {
          state, project, saving: false, dirty: false,
          onTheme: () => setState((s) => Object.assign({}, s, { theme: s.theme === 'dark' ? 'light' : 'dark' })),
          onMode: (m) => setState((s) => Object.assign({}, s, { mode: m })),
          onBack, onCopy,
        }),
        h('div', { className: 'cfw-body' },
          h(SectionA, { project, cards, templates, state, setState, status: ((project.brief && project.brief.complete) ? '已齐' : '还差几项') }),
          h(SectionB, { project, state, setState, cardMap }),
          h(SectionC, { cards, templates, state, setState })
        ),
        h(BottomBar, { project, cardMap })
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
