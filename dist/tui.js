// @bun
var __require = import.meta.require;

// src/index.tsx
import { createComponent as _$createComponent } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { spread as _$spread } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
var GLM_ID_RE = /zhipu|bigmodel|z\.ai/i;
function findProvider(api) {
  const list = api?.state?.provider ?? [];
  return list.find((p) => {
    const bu = typeof p?.options?.baseURL === "string" ? p.options.baseURL : "";
    if (/api\.z\.ai|open\.bigmodel\.cn|dev\.bigmodel\.cn/i.test(bu))
      return true;
    return GLM_ID_RE.test(`${p?.id ?? ""} ${p?.name ?? ""}`);
  });
}
function tokenOf(p) {
  return p?.options?.apiKey ?? p?.key;
}
function monitorBase(baseURL) {
  if (!baseURL)
    return "https://open.bigmodel.cn";
  try {
    const u = new URL(baseURL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return baseURL;
  }
}
async function credFromAuthFile() {
  try {
    const fs = await import("fs");
    const os = await import("os");
    const p = await import("path");
    const file = p.join(os.homedir(), ".local", "share", "opencode", "auth.json");
    const auth = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const id of ["zhipuai-coding-plan", "zai-coding-plan", "zhipu"]) {
      const rec = auth?.[id];
      if (rec?.type === "api" && typeof rec.key === "string" && rec.key) {
        return {
          key: rec.key,
          baseURL: id.includes("zai") ? "https://api.z.ai" : "https://open.bigmodel.cn"
        };
      }
    }
  } catch {}
  return {};
}
var RESET_KEYS = ["nextResetTime", "resetTime", "refreshTime", "resetAt", "endTime", "windowEnd", "expireTime", "nextWindowTime", "windowEndTime", "resetTimestamp"];
function fmtReset(v) {
  if (v == null)
    return;
  let ms;
  if (typeof v === "number") {
    ms = v > 1000000000000 ? v : v > 1e9 ? v * 1000 : v;
  } else if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n))
      ms = n > 1000000000000 ? n : n > 1e9 ? n * 1000 : n;
    else {
      const t = Date.parse(v);
      if (!Number.isNaN(t))
        ms = t;
    }
  }
  if (ms == null || Number.isNaN(ms))
    return String(v);
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
var tui = async (api) => {
  const [status, setStatus] = createSignal({
    fetchedAt: 0
  });
  let timer;
  let last = 0;
  let offIdle;
  async function refresh(force = false) {
    const now = Date.now();
    if (!force && now - last < 30000)
      return;
    const p = findProvider(api);
    const authed = await credFromAuthFile();
    const token = tokenOf(p) ?? authed.key;
    const base = p ? monitorBase(p?.options?.baseURL) : authed.baseURL;
    if (!token) {
      setStatus({
        error: "\u672A\u627E\u5230\u667A\u8C31 provider",
        fetchedAt: now
      });
      return;
    }
    last = now;
    try {
      const res = await fetch(`${base}/api/monitor/usage/quota/limit`, {
        headers: {
          Authorization: token,
          "Accept-Language": "zh-CN,zh"
        }
      });
      const text = await res.text();
      if (!res.ok) {
        setStatus({
          error: `HTTP ${res.status}`,
          fetchedAt: now
        });
        return;
      }
      const json = JSON.parse(text);
      const data = json?.data ?? json;
      const limits = Array.isArray(data?.limits) ? data.limits : [];
      const tok = limits.find((l) => l?.type === "TOKENS_LIMIT");
      const mcp = limits.find((l) => l?.type === "TIME_LIMIT");
      let reset;
      for (const key of RESET_KEYS) {
        if (data?.[key] != null) {
          reset = fmtReset(data[key]);
          break;
        }
      }
      if (reset == null && tok?.nextResetTime != null)
        reset = fmtReset(tok.nextResetTime);
      setStatus({
        pct: typeof tok?.percentage === "number" ? tok.percentage : undefined,
        reset,
        mcpLeft: typeof mcp?.remaining === "number" ? mcp.remaining : undefined,
        level: typeof data?.level === "string" ? data.level : undefined,
        fetchedAt: now
      });
    } catch (e) {
      setStatus({
        error: e?.message ?? String(e),
        fetchedAt: now
      });
    }
  }
  refresh(true);
  timer = setInterval(() => void refresh(), 30000);
  try {
    offIdle = api?.event?.on?.("session.idle", () => void refresh());
  } catch {}
  try {
    api?.lifecycle?.onDispose?.(() => {
      if (timer)
        clearInterval(timer);
      try {
        offIdle?.();
      } catch {}
    });
  } catch {}
  try {
    api?.slots?.register?.({
      order: 60,
      slots: {
        session_prompt_right() {
          const theme = () => api?.theme?.current;
          const s = status();
          const remaining = s.pct != null ? Math.max(0, Math.min(100, 100 - s.pct)) : undefined;
          const color = () => {
            const t = theme();
            if (!t || remaining == null)
              return;
            if (remaining > 40)
              return t.success;
            if (remaining > 15)
              return t.warning;
            return t.error;
          };
          const barWidth = 8;
          const filled = () => Math.round((remaining ?? 0) / 100 * barWidth);
          const layout = s.error ? {} : {
            flexDirection: "row",
            gap: 1,
            paddingRight: 1
          };
          return _$createComponent(Show, {
            get when() {
              return findProvider(api) || s.fetchedAt > 0;
            },
            get children() {
              var _el$ = _$createElement("box");
              _$spread(_el$, layout, true);
              _$insert(_el$, _$createComponent(Show, {
                get when() {
                  return !s.error;
                },
                get fallback() {
                  return (() => {
                    var _el$12 = _$createElement("text");
                    _$insertNode(_el$12, _$createTextNode(`GLM ?`));
                    _$effect((_$p) => _$setProp(_el$12, "fg", theme()?.textMuted, _$p));
                    return _el$12;
                  })();
                },
                get children() {
                  return [(() => {
                    var _el$2 = _$createElement("text");
                    _$insertNode(_el$2, _$createTextNode(`GLM`));
                    _$effect((_$p) => _$setProp(_el$2, "fg", theme()?.textMuted, _$p));
                    return _el$2;
                  })(), (() => {
                    var _el$4 = _$createElement("text");
                    _$insert(_el$4, () => "█".repeat(filled()));
                    _$effect((_$p) => _$setProp(_el$4, "fg", color(), _$p));
                    return _el$4;
                  })(), (() => {
                    var _el$5 = _$createElement("text");
                    _$insert(_el$5, () => "░".repeat(barWidth - filled()));
                    _$effect((_$p) => _$setProp(_el$5, "fg", theme()?.textMuted, _$p));
                    return _el$5;
                  })(), (() => {
                    var _el$6 = _$createElement("text");
                    _$insert(_el$6, remaining != null ? `${remaining}%` : "?");
                    _$effect((_$p) => _$setProp(_el$6, "fg", color(), _$p));
                    return _el$6;
                  })(), _$createComponent(Show, {
                    get when() {
                      return s.reset;
                    },
                    get children() {
                      var _el$7 = _$createElement("text"), _el$8 = _$createTextNode(`↻`);
                      _$insertNode(_el$7, _el$8);
                      _$insert(_el$7, () => s.reset, null);
                      _$effect((_$p) => _$setProp(_el$7, "fg", theme()?.textMuted, _$p));
                      return _el$7;
                    }
                  }), _$createComponent(Show, {
                    get when() {
                      return s.mcpLeft != null;
                    },
                    get children() {
                      var _el$9 = _$createElement("text"), _el$0 = _$createTextNode(`MCP `);
                      _$insertNode(_el$9, _el$0);
                      _$insert(_el$9, () => s.mcpLeft, null);
                      _$effect((_$p) => _$setProp(_el$9, "fg", theme()?.textMuted, _$p));
                      return _el$9;
                    }
                  }), _$createComponent(Show, {
                    get when() {
                      return s.level;
                    },
                    get children() {
                      var _el$1 = _$createElement("text"), _el$10 = _$createTextNode(`[`), _el$11 = _$createTextNode(`]`);
                      _$insertNode(_el$1, _el$10);
                      _$insertNode(_el$1, _el$11);
                      _$insert(_el$1, () => s.level, _el$11);
                      _$effect((_$p) => _$setProp(_el$1, "fg", theme()?.textMuted, _$p));
                      return _el$1;
                    }
                  })];
                }
              }));
              return _el$;
            }
          });
        }
      }
    });
  } catch (e) {
    console.error("[glm-status] slots.register 失败", e);
  }
};
var src_default = {
  id: "glm-status",
  tui
};
export {
  src_default as default
};
