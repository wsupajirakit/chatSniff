import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import {
  fetchTelegramUpdates,
  findChatIdByKeyword,
  normalizeToken,
  type TelegramUpdate
} from './telegram.js';

const app = new Hono();

const toJsonStatus = (
  status: number
): 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503 => {
  if (status === 400) return 400;
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 429) return 429;
  if (status === 502) return 502;
  if (status === 503) return 503;
  return 500;
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parseBody = async (c: Context): Promise<Record<string, unknown>> => {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== 'object') return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
};

const renderViaTelegramPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Telegram Via Helper</title>
    <style>
      :root {
        --bg: #0b1220;
        --card: #111a2e;
        --muted: #8ea0bd;
        --text: #ebf1fa;
        --primary: #2f9cff;
        --success: #1fa66a;
        --warning: #f5a524;
        --error: #f05252;
        --border: #24324f;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        background: radial-gradient(circle at top, #14213d 0%, var(--bg) 45%);
        color: var(--text);
      }

      main {
        width: min(900px, 100%);
        margin: 0 auto;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: linear-gradient(180deg, #121d34 0%, var(--card) 100%);
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.45);
        overflow: hidden;
      }

      section { padding: 20px; border-top: 1px solid var(--border); }
      section:first-child { border-top: 0; }
      h1 { margin: 0; font-size: 1.6rem; }
      h2 { margin: 0 0 12px; font-size: 1rem; color: #bbcbeb; }
      p { margin: 8px 0 0; color: var(--muted); line-height: 1.5; }

      form { display: grid; gap: 12px; margin-top: 12px; }

      label {
        font-size: 0.9rem;
        color: #bbcbeb;
      }

      input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 12px;
        background: #0d1528;
        color: var(--text);
        font-size: 0.95rem;
      }

      button {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }

      button:disabled { opacity: 0.6; cursor: not-allowed; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      .btn-primary { background: var(--primary); }
      .btn-success { background: var(--success); }
      .btn-muted { background: #24324f; }
      .result {
        margin-top: 12px;
        border-radius: 12px;
        padding: 12px;
        border: 1px solid var(--border);
        background: #0d1528;
      }
      .result.success { border-color: rgba(31, 166, 106, 0.6); }
      .result.error { border-color: rgba(240, 82, 82, 0.6); }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; }
      pre {
        margin: 12px 0 0;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #0a1122;
        color: #c7d7f4;
        max-height: 340px;
        overflow: auto;
        white-space: pre-wrap;
      }
      .muted { color: var(--muted); }
      .meta { font-size: 0.85rem; color: #bbcbeb; }
      @media (max-width: 640px) {
        body { padding: 12px; }
        section { padding: 14px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Telegram Chat ID via Helper</h1>
        <p>Only Telegram via logic with Hono: fetch updates, then find chat ID by keyword.</p>
      </section>

      <section>
        <h2>1) Fetch updates</h2>
        <form id="token-form">
          <div>
            <label for="token">Telegram token</label>
            <input id="token" name="token" placeholder="123456789:AA..." autocomplete="off" />
          </div>
          <div class="row">
            <button class="btn-primary" type="submit" id="fetch-btn">Fetch getUpdates</button>
            <button class="btn-muted" type="button" id="copy-token-btn">Copy normalized token</button>
          </div>
        </form>
        <div id="fetch-result" class="result muted">No request yet.</div>
      </section>

      <section>
        <h2>2) Find chat ID by keyword</h2>
        <form id="keyword-form">
          <div>
            <label for="keyword">Keyword (must exist in message text)</label>
            <input id="keyword" name="keyword" placeholder="example_keyword" autocomplete="off" />
          </div>
          <div class="row">
            <button class="btn-success" type="submit" id="find-btn">Find chat ID</button>
            <button class="btn-muted" type="button" id="copy-chat-id-btn">Copy chat ID</button>
          </div>
        </form>
        <div id="chat-result" class="result muted">No search yet.</div>
      </section>

      <section>
        <h2>Raw JSON</h2>
        <div class="meta" id="raw-meta">Waiting for Telegram response...</div>
        <pre id="raw-json" class="mono">{}</pre>
      </section>
    </main>

    <script>
      const state = {
        token: '',
        updates: [],
        chatId: ''
      };

      const tokenForm = document.getElementById('token-form');
      const keywordForm = document.getElementById('keyword-form');
      const tokenInput = document.getElementById('token');
      const keywordInput = document.getElementById('keyword');
      const fetchBtn = document.getElementById('fetch-btn');
      const findBtn = document.getElementById('find-btn');
      const copyTokenBtn = document.getElementById('copy-token-btn');
      const copyChatIdBtn = document.getElementById('copy-chat-id-btn');
      const fetchResult = document.getElementById('fetch-result');
      const chatResult = document.getElementById('chat-result');
      const rawJson = document.getElementById('raw-json');
      const rawMeta = document.getElementById('raw-meta');

      const setResult = (node, type, message) => {
        node.className = 'result ' + type;
        node.textContent = message;
      };

      const asPrettyJson = (value) => {
        try {
          return JSON.stringify(value, null, 2);
        } catch (error) {
          return String(value);
        }
      };

      const copyText = async (value) => {
        if (!value) return false;
        try {
          await navigator.clipboard.writeText(value);
          return true;
        } catch (error) {
          return false;
        }
      };

      tokenForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const token = tokenInput.value.trim();
        if (!token) {
          setResult(fetchResult, 'error', 'Token is required.');
          return;
        }

        fetchBtn.disabled = true;
        setResult(fetchResult, 'muted', 'Loading Telegram updates...');

        try {
          const response = await fetch('/api/telegram/get-updates', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token })
          });
          const payload = await response.json();

          if (!response.ok || !payload.ok) {
            setResult(fetchResult, 'error', payload.error || 'Telegram request failed.');
            rawJson.textContent = asPrettyJson(payload.raw || payload);
            rawMeta.textContent = 'Telegram request failed.';
            state.updates = [];
            state.chatId = '';
            return;
          }

          state.token = payload.token || token;
          state.updates = Array.isArray(payload.updates) ? payload.updates : [];
          state.chatId = '';
          tokenInput.value = state.token;

          setResult(fetchResult, 'success', 'Fetched ' + state.updates.length + ' updates.');
          rawMeta.textContent = 'Fetched updates successfully.';
          rawJson.textContent = asPrettyJson(payload.raw);
          setResult(chatResult, 'muted', 'Now enter a keyword to find chat ID.');
        } catch (error) {
          setResult(fetchResult, 'error', error.message || 'Cannot connect to API.');
        } finally {
          fetchBtn.disabled = false;
        }
      });

      keywordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const keyword = keywordInput.value.trim();
        if (!keyword) {
          setResult(chatResult, 'error', 'Keyword is required.');
          return;
        }

        findBtn.disabled = true;
        setResult(chatResult, 'muted', 'Finding chat ID...');

        try {
          const response = await fetch('/api/telegram/find-chat-id', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              keyword,
              updates: state.updates,
              token: state.token || tokenInput.value.trim()
            })
          });
          const payload = await response.json();

          if (!response.ok || !payload.ok) {
            setResult(chatResult, 'error', payload.error || 'Chat ID not found.');
            return;
          }

          state.chatId = payload.chatId || '';
          const details = [
            'chatId: ' + state.chatId,
            payload.chatType ? 'chatType: ' + payload.chatType : null,
            payload.chatName ? 'chatName: ' + payload.chatName : null,
            payload.matchedUpdateId !== null ? 'updateId: ' + payload.matchedUpdateId : null
          ].filter(Boolean).join(' | ');
          setResult(chatResult, 'success', details || 'Chat ID found.');
        } catch (error) {
          setResult(chatResult, 'error', error.message || 'Cannot connect to API.');
        } finally {
          findBtn.disabled = false;
        }
      });

      copyTokenBtn.addEventListener('click', async () => {
        const copied = await copyText(state.token || tokenInput.value.trim());
        setResult(fetchResult, copied ? 'success' : 'error', copied ? 'Token copied.' : 'Cannot copy token.');
      });

      copyChatIdBtn.addEventListener('click', async () => {
        const copied = await copyText(state.chatId);
        setResult(chatResult, copied ? 'success' : 'error', copied ? 'Chat ID copied.' : 'No chat ID to copy.');
      });
    </script>
  </body>
</html>
`;

app.use('/api/*', cors());

app.get('/', (c) => c.redirect('/via-telegram'));

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'telegram-via-helper'
  });
});

app.get('/via-telegram', (c) => {
  return c.html(renderViaTelegramPage());
});

app.post('/api/telegram/get-updates', async (c) => {
  const body = await parseBody(c);
  const token = String(body.token ?? '');

  if (!normalizeToken(token)) {
    return c.json(
      {
        ok: false,
        error: 'token is required'
      },
      400
    );
  }

  const result = await fetchTelegramUpdates(token, {
    limit: toOptionalNumber(body.limit),
    offset: toOptionalNumber(body.offset),
    timeout: toOptionalNumber(body.timeout)
  });

  if (!result.ok) {
    return c.json(
      {
        ok: false,
        error: result.error,
        raw: result.raw
      },
      toJsonStatus(result.status)
    );
  }

  return c.json({
    ok: true,
    token: result.token,
    updatesCount: result.updates.length,
    updates: result.updates,
    raw: result.raw
  });
});

app.post('/api/telegram/find-chat-id', async (c) => {
  const body = await parseBody(c);
  const keyword = String(body.keyword ?? '').trim();

  if (!keyword) {
    return c.json(
      {
        ok: false,
        error: 'keyword is required'
      },
      400
    );
  }

  let updates: TelegramUpdate[] = [];
  let token: string | undefined;

  if (Array.isArray(body.updates)) {
    updates = body.updates as TelegramUpdate[];
  } else {
    const tokenInput = String(body.token ?? '');
    if (!normalizeToken(tokenInput)) {
      return c.json(
        {
          ok: false,
          error: 'token is required when updates are not provided'
        },
        400
      );
    }

    const result = await fetchTelegramUpdates(tokenInput, {
      limit: toOptionalNumber(body.limit),
      offset: toOptionalNumber(body.offset),
      timeout: toOptionalNumber(body.timeout)
    });

    if (!result.ok) {
      return c.json(
        {
          ok: false,
          error: result.error,
          raw: result.raw
        },
        toJsonStatus(result.status)
      );
    }

    token = result.token;
    updates = result.updates;
  }

  const match = findChatIdByKeyword(updates, keyword);
  if (!match) {
    return c.json(
      {
        ok: false,
        error: 'chat id not found for keyword',
        keyword,
        updatesCount: updates.length
      },
      404
    );
  }

  return c.json({
    ok: true,
    keyword,
    token,
    updatesCount: updates.length,
    chatId: match.chatId,
    matchedText: match.matchedText,
    matchedUpdateId: match.matchedUpdateId,
    chatType: match.chatType,
    chatName: match.chatName
  });
});

const port = Number(process.env.PORT ?? 3000);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`Telegram via helper is running on http://localhost:${info.port}`);
  }
);

export default app;
