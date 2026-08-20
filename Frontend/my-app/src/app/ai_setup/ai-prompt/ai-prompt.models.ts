export interface AiPromptItem {
  id: string;
  name: string;
  extension: string;
  introduction: string;
  prompt: string;
  enabled: boolean;
}

/** Request body expected by POST /ai/ai-prompt/create */
export interface AiPromptPayload {
  id?: string | null;
  company_id: number | string | null;
  user_id: number | string | null;
  name: string;
  extension: string;
  introduction: string;
  prompt: string;
  enabled: boolean;
}

export function emptyPrompt(): AiPromptItem {
  return {
    id: '',
    name: '',
    extension: '',
    introduction: '',
    prompt: '',
    enabled: true,
  };
}

/** Shared prompt template variables (inserted as %name). */
export const PROMPT_VARIABLES = [
  'datetime',
  'date',
  'time',
  'today',
] as const;

export type PromptVariable = (typeof PROMPT_VARIABLES)[number];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Current values used when resolving %datetime / %date / %time / %today. */
export function getPromptVariableValues(
  now: Date = new Date()
): Record<PromptVariable, string> {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return {
    date,
    today: date,
    time,
    datetime: `${date} ${time}`,
  };
}

/** Replace %key (and {{key}}) placeholders; longer keys first. */
export function resolvePromptPlaceholders(
  template: string,
  vars: Record<string, string> = getPromptVariableValues()
): string {
  if (!template) {
    return '';
  }
  let out = template;
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const value = vars[key] ?? '';
    out = out.split(`{{${key}}}`).join(value);
    out = out.replace(new RegExp(`%${key}(?![A-Za-z0-9_])`, 'g'), value);
  }
  return out;
}
