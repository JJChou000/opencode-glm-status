/** @jsxImportSource @opentui/solid */
import { createSignal, Show, type JSX } from "solid-js"
import type { TuiPlugin } from "@opencode-ai/plugin/tui"

type ProviderLike = {
  id: string
  name?: string
  key?: string
  options?: Record<string, unknown>
}

const GLM_ID_RE = /zhipu|bigmodel|z\.ai/i

function findProvider(api: any): ProviderLike | undefined {
  const list = (api?.state?.provider ?? []) as ProviderLike[]
  return list.find((p) => {
    const bu = typeof p?.options?.baseURL === "string" ? (p.options.baseURL as string) : ""
    if (/api\.z\.ai|open\.bigmodel\.cn|dev\.bigmodel\.cn/i.test(bu)) return true
    return GLM_ID_RE.test(`${p?.id ?? ""} ${p?.name ?? ""}`)
  })
}

function tokenOf(p: ProviderLike | undefined): string | undefined {
  return (p?.options?.apiKey as string) ?? p?.key
}

function monitorBase(baseURL?: string): string {
  if (!baseURL) return "https://open.bigmodel.cn"
  try {
    const u = new URL(baseURL)
    return `${u.protocol}//${u.host}`
  } catch {
    return baseURL
  }
}

async function credFromAuthFile(): Promise<{ key?: string; baseURL?: string }> {
  try {
    const fs = await import("node:fs")
    const os = await import("node:os")
    const p = await import("node:path")
    const file = p.join(os.homedir(), ".local", "share", "opencode", "auth.json")
    const auth = JSON.parse(fs.readFileSync(file, "utf8"))
    for (const id of ["zhipuai-coding-plan", "zai-coding-plan", "zhipu"]) {
      const rec = auth?.[id]
      if (rec?.type === "api" && typeof rec.key === "string" && rec.key) {
        return {
          key: rec.key,
          baseURL: id.includes("zai") ? "https://api.z.ai" : "https://open.bigmodel.cn",
        }
      }
    }
  } catch {
    /* 忽略 */
  }
  return {}
}

const RESET_KEYS = [
  "nextResetTime",
  "resetTime",
  "refreshTime",
  "resetAt",
  "endTime",
  "windowEnd",
  "expireTime",
  "nextWindowTime",
  "windowEndTime",
  "resetTimestamp",
]

function fmtReset(v: unknown): string | undefined {
  if (v == null) return undefined
  let ms: number | undefined
  if (typeof v === "number") {
    ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : v
  } else if (typeof v === "string") {
    const n = Number(v)
    if (!Number.isNaN(n)) ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : n
    else {
      const t = Date.parse(v)
      if (!Number.isNaN(t)) ms = t
    }
  }
  if (ms == null || Number.isNaN(ms)) return String(v)
  const d = new Date(ms)
  const pad = (x: number) => String(x).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Status = {
  pct?: number
  reset?: string
  error?: string
  fetchedAt: number
}

const tui: TuiPlugin = async (api: any) => {
  const [status, setStatus] = createSignal<Status>({ fetchedAt: 0 })
  let timer: ReturnType<typeof setInterval> | undefined
  let last = 0
  let offIdle: (() => void) | undefined

  async function refresh(force = false) {
    const now = Date.now()
    if (!force && now - last < 30000) return
    const p = findProvider(api)
    const authed = await credFromAuthFile()
    const token = tokenOf(p) ?? authed.key
    const base = p ? monitorBase(p?.options?.baseURL as string | undefined) : authed.baseURL
    if (!token) {
      setStatus({ error: "未找到智谱 provider", fetchedAt: now })
      return
    }
    last = now
    try {
      const res = await fetch(`${base}/api/monitor/usage/quota/limit`, {
        headers: { Authorization: token, "Accept-Language": "zh-CN,zh" },
      })
      const text = await res.text()
      if (!res.ok) {
        setStatus({ error: `HTTP ${res.status}`, fetchedAt: now })
        return
      }
      const json = JSON.parse(text)
      const data = json?.data ?? json
      const limits: any[] = Array.isArray(data?.limits) ? data.limits : []
      const tok = limits.find((l: any) => l?.type === "TOKENS_LIMIT")
      let reset: string | undefined
      for (const key of RESET_KEYS) {
        if (data?.[key] != null) {
          reset = fmtReset(data[key])
          break
        }
      }
      if (reset == null && tok?.nextResetTime != null) reset = fmtReset(tok.nextResetTime)
      setStatus({
        pct: typeof tok?.percentage === "number" ? tok.percentage : undefined,
        reset,
        fetchedAt: now,
      })
    } catch (e: any) {
      setStatus({ error: e?.message ?? String(e), fetchedAt: now })
    }
  }

  void refresh(true)
  timer = setInterval(() => void refresh(), 30000)
  try {
    offIdle = api?.event?.on?.("session.idle", () => void refresh())
  } catch {
    /* 忽略 */
  }
  try {
    api?.lifecycle?.onDispose?.(() => {
      if (timer) clearInterval(timer)
      try {
        offIdle?.()
      } catch {
        /* 忽略 */
      }
    })
  } catch {
    /* 忽略 */
  }

  try {
    api?.slots?.register?.({
      order: 60,
      slots: {
        session_prompt_right(): JSX.Element {
          const theme = () => api?.theme?.current
          const s = status()
          const remaining = s.pct != null ? Math.max(0, Math.min(100, 100 - s.pct)) : undefined
          const color = () => {
            const t = theme()
            if (!t || remaining == null) return undefined
            if (remaining > 40) return t.success
            if (remaining > 15) return t.warning
            return t.error
          }
          const layout = s.error ? {} : { flexDirection: "row", gap: 1, paddingRight: 1 }
          return (
            <Show when={findProvider(api) || s.fetchedAt > 0}>
              <box {...layout}>
                <Show
                  when={!s.error}
                  fallback={
                    <text fg={theme()?.textMuted}>GLM ?</text>
                  }
                >
                  <text fg={theme()?.textMuted}>GLM</text>
                  <text fg={color()}>{remaining != null ? `${remaining}%` : "?"}</text>
                  <Show when={s.reset}>
                    <text fg={theme()?.textMuted}>↻{s.reset}</text>
                  </Show>
                </Show>
              </box>
            </Show>
          )
        },
      },
    })
  } catch (e) {
    console.error("[glm-status] slots.register 失败", e)
  }
}

export default { id: "glm-status", tui }