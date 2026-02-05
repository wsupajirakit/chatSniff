export type TelegramChat = {
  id?: number | string;
  title?: string;
  type?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramMessage = {
  text?: string;
  caption?: string;
  chat?: TelegramChat;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

export type TelegramApiResult = {
  ok: boolean;
  status: number;
  token?: string;
  updates: TelegramUpdate[];
  raw: unknown;
  error?: string;
};

export type TelegramChatIdMatch = {
  chatId: string;
  matchedText: string;
  matchedUpdateId: number | null;
  chatType: string | null;
  chatName: string | null;
};

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

const parseJsonSafely = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeLimit = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(1, Math.trunc(value)));
};

const normalizeOffset = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
};

const normalizeTimeout = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(50, Math.max(0, Math.trunc(value)));
};

export const normalizeToken = (value: string) => {
  let token = value.trim().replace(/\s+/g, '');
  token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
  token = token.replace(/\/getUpdates.*$/i, '');
  token = token.replace(/^bot/i, '');
  return token;
};

const pickMessage = (update: TelegramUpdate): TelegramMessage | null => {
  return (
    update.message ??
    update.edited_message ??
    update.channel_post ??
    update.edited_channel_post ??
    null
  );
};

const getMessageText = (message: TelegramMessage | null) => {
  if (!message) return '';
  const value = message.text ?? message.caption ?? '';
  return String(value).trim();
};

const getChatName = (chat: TelegramChat | undefined) => {
  if (!chat) return null;
  if (chat.title) return chat.title;
  if (chat.username) return chat.username;
  const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ').trim();
  return fullName || null;
};

export const fetchTelegramUpdates = async (
  tokenInput: string,
  options: { limit?: number; offset?: number; timeout?: number } = {}
): Promise<TelegramApiResult> => {
  const token = normalizeToken(tokenInput);
  if (!token) {
    return {
      ok: false,
      status: 400,
      error: 'token is required',
      updates: [],
      raw: null
    };
  }

  const params = new URLSearchParams();
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const timeout = normalizeTimeout(options.timeout);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  if (timeout !== undefined) params.set('timeout', String(timeout));

  const query = params.toString();
  const endpoint = `${TELEGRAM_API_BASE_URL}/bot${token}/getUpdates${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(endpoint);
    const text = await response.text();
    const raw = parseJsonSafely(text);
    const rawObject = asObject(raw);
    const description = rawObject?.description ? String(rawObject.description) : '';

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: description || `telegram returned HTTP ${response.status}`,
        token,
        updates: [],
        raw
      };
    }

    const result = rawObject?.result;
    const updates = Array.isArray(result) ? (result as TelegramUpdate[]) : [];
    const telegramOk = rawObject?.ok;

    if (telegramOk === false) {
      return {
        ok: false,
        status: 400,
        error: description || 'telegram returned ok=false',
        token,
        updates,
        raw
      };
    }

    return {
      ok: true,
      status: 200,
      token,
      updates,
      raw
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : 'failed to connect telegram api',
      token,
      updates: [],
      raw: null
    };
  }
};

export const findChatIdByKeyword = (updates: TelegramUpdate[], keywordInput: string): TelegramChatIdMatch | null => {
  const keyword = keywordInput.trim();
  if (!keyword) return null;

  for (const update of updates) {
    const message = pickMessage(update);
    const messageText = getMessageText(message);
    if (!messageText.includes(keyword)) {
      continue;
    }

    const chatId = message?.chat?.id;
    if (chatId === undefined || chatId === null) {
      continue;
    }

    return {
      chatId: String(chatId),
      matchedText: messageText,
      matchedUpdateId: typeof update.update_id === 'number' ? update.update_id : null,
      chatType: message?.chat?.type ?? null,
      chatName: getChatName(message?.chat)
    };
  }

  return null;
};
