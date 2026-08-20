/**
 * Loads AI prompt / functions / settings from DB for the voice bridge.
 * Falls back gracefully when rows are missing so calls still work.
 */
const AiPrompt = require("./models/ai_prompt_modal");
const AiFunction = require("./models/ai_function_modal");
const AiSetting = require("./models/ai_setting_modal");

const LOCAL_TOOL_NAMES = new Set([
  "get_available_slots",
  "book_appointment",
  "confirm_booking",
]);

function mapParamType(type) {
  const t = String(type || "string").toLowerCase();
  if (["string", "number", "boolean", "integer", "object", "array"].includes(t)) {
    return t;
  }
  return "string";
}

function normalizeFunctionDirection(value) {
  const direction = String(value || "both").toLowerCase();
  if (["inbound", "outbound", "both"].includes(direction)) {
    return direction;
  }
  return "both";
}

function normalizeCallDirection(value) {
  // When direction is not provided, don't filter by inbound/outbound.
  if (value === null || value === undefined || value === "") return null;
  return String(value).toLowerCase() === "outbound" ? "outbound" : "inbound";
}

function matchesCallDirection(fnDirection, callDirection) {
  const scoped = normalizeFunctionDirection(fnDirection);
  // If we don't know the call direction, allow all enabled functions.
  if (callDirection === null) return true;
  if (scoped === "both") return true;
  return scoped === normalizeCallDirection(callDirection);
}

function buildToolsFromDb(functions) {
  return (functions || []).map((fn) => {
    const params = Array.isArray(fn.parameters) ? fn.parameters : [];
    const sorted = [...params].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    const properties = {};
    const required = [];

    for (const p of sorted) {
      const name = p.parameter_name;
      if (!name) continue;
      properties[name] = {
        type: mapParamType(p.parameter_type),
        description: p.description || "",
      };
      if (p.is_required) required.push(name);
    }

    return {
      type: "function",
      name: fn.function_name,
      description: fn.description || "",
      parameters: {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      },
    };
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Date/time values for prompt placeholders (%datetime, %date, %time, %today, …).
 * @param {{ today?: string, tomorrow?: string, dayAfter?: string } | null} dates
 * @param {Date} [now]
 */
function buildDateTimeVars(dates = null, now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const date = dates?.today || `${yyyy}-${mm}-${dd}`;
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  const time = `${hh}:${mi}:${ss}`;
  const datetime = `${date} ${time}`;

  return {
    today: date,
    date,
    time,
    datetime,
    tomorrow: dates?.tomorrow || "",
    day_after: dates?.dayAfter || "",
  };
}

/**
 * Replaces {{key}} and %key placeholders. Longer keys first so %date
 * does not partially consume %datetime.
 */
function applyPlaceholders(template, vars) {
  if (!template) return "";
  let out = String(template);
  const keys = Object.keys(vars || {}).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const value = vars[key] == null ? "" : String(vars[key]);
    out = out.split(`{{${key}}}`).join(value);
    out = out.replace(
      new RegExp(`%${escapeRegExp(key)}(?![A-Za-z0-9_])`, "g"),
      value
    );
  }
  return out;
}

function buildDynamicInstructions(promptRow, patient, dates) {
  const dateVars = buildDateTimeVars(dates);
  const vars = {
    patient_name: patient.patientName || "Unknown",
    phone: patient.phone || "Unknown",
    email: patient.email || "Unknown",
    dob: patient.patient_dob || "Unknown",
    ...dateVars,
  };

  const rawTemplate = promptRow.prompt_body || promptRow.prompt || "";
  const body = applyPlaceholders(rawTemplate, vars).trim();

  // Check whether the prompt template references patient/date placeholders.
  // If it does, the template has already had them injected — no need to append.
  const templateUsesPatient =
    rawTemplate.includes("{{patient_name}}") ||
    rawTemplate.includes("%patient_name") ||
    rawTemplate.includes("{{phone}}") ||
    rawTemplate.includes("%phone") ||
    rawTemplate.includes("{{email}}") ||
    rawTemplate.includes("%email") ||
    rawTemplate.includes("{{dob}}") ||
    rawTemplate.includes("%dob") ||
    rawTemplate.includes("PATIENT ON THIS CALL");

  const templateUsesDates =
    rawTemplate.includes("{{today}}") ||
    rawTemplate.includes("%today") ||
    rawTemplate.includes("{{tomorrow}}") ||
    rawTemplate.includes("%tomorrow") ||
    rawTemplate.includes("{{day_after}}") ||
    rawTemplate.includes("%day_after") ||
    rawTemplate.includes("Today:");

  if (!body) {
    // Nothing stored — build a minimal context block
    return `PATIENT ON THIS CALL:\n- Name: ${vars.patient_name}\n- Phone: ${vars.phone}\n- Email: ${vars.email}\n- Date of birth: ${vars.dob}\n\nToday: ${vars.today}, Tomorrow: ${vars.tomorrow}, Day after tomorrow: ${vars.day_after}`;
  }

  // Build only the missing context blocks to avoid duplication
  const extraParts = [];

  if (!templateUsesPatient) {
    extraParts.push(
      `PATIENT ON THIS CALL:\n- Name: ${vars.patient_name}\n- Phone: ${vars.phone}\n- Email: ${vars.email}\n- Date of birth: ${vars.dob}`
    );
  }

  if (!templateUsesDates) {
    extraParts.push(
      `Today: ${vars.today}, Tomorrow: ${vars.tomorrow}, Day after tomorrow: ${vars.day_after}`
    );
  }

  if (!extraParts.length) return body;
  return `${body}\n\n${extraParts.join("\n\n")}`;
}

function buildDynamicGreeting(promptRow, patientName, dates = null) {
  const vars = {
    patient_name: patientName || "there",
    ...buildDateTimeVars(dates),
  };

  const intro = promptRow?.introduction
    ? applyPlaceholders(promptRow.introduction, vars)
    : null;

  if (intro && intro.trim()) {
    return `[Call started. Greet the patient with: "${intro.trim()}"]`;
  }

  return `[Call started. Greet the caller warmly and briefly by their name: ${patientName || "there"}.]`;
}

/**
 * @param {{ companyId?: string|number|null, extension?: string|null, direction?: string|null }} opts
 */
async function loadCallConfig({
  companyId = null,
  extension = null,
  direction = null,
} = {}) {
  const callDirection = normalizeCallDirection(direction);
  const result = {
    prompt: null,
    functions: [],
    settings: null,
    tools: null,
    direction: callDirection,
    source: { prompt: "fallback", tools: "fallback", settings: "fallback" },
  };

  try {
    let promptQuery = AiPrompt.query((qb) => {
      qb.where("enabled", true);
      if (companyId != null && companyId !== "") {
        qb.andWhere("company_id", companyId);
      }
      if (extension) {
        qb.andWhere("extension", String(extension));
      }
      qb.orderBy("updated_at", "desc");
      qb.limit(1);
    });

    let prompt = await promptQuery.fetch({ require: false });

    // Extension-only fallback if company-scoped miss
    if (!prompt && extension && companyId != null && companyId !== "") {
      prompt = await AiPrompt.query((qb) => {
        qb.where({ enabled: true, extension: String(extension) });
        qb.orderBy("updated_at", "desc");
        qb.limit(1);
      }).fetch({ require: false });
    }

    if (prompt) {
      result.prompt = prompt.toJSON();
      result.source.prompt = "db";
    }
  } catch (err) {
    console.error("❌ loadCallConfig prompt:", err.message);
  }

  try {
    let fnQuery = AiFunction;
    const where = { enabled: true };
    if (companyId != null && companyId !== "") {
      where.company_id = companyId;
    }
    const functions = await fnQuery.where(where).fetchAll({
      withRelated: ["parameters"],
    });
    const list = functions
      .toJSON()
      .filter((f) => f.function_name)
      .filter((f) => matchesCallDirection(f.direction, callDirection));
    if (list.length) {
      result.functions = list;
      result.tools = buildToolsFromDb(list);
      result.source.tools = "db";
    }
  } catch (err) {
    console.error("❌ loadCallConfig functions:", err.message);
  }

  try {
    const settings = await AiSetting.query((qb) => {
      if (companyId != null && companyId !== "") {
        qb.where("company_id", companyId);
      }
      qb.orderBy("id", "desc").limit(1);
    }).fetch({ require: false });

    if (settings) {
      result.settings = settings.toJSON();
      result.source.settings = "db";
    }
  } catch (err) {
    console.error("❌ loadCallConfig settings:", err.message);
  }

  return result;
}

async function executeHttpTool(fn, args) {
  const axios = require("axios");
  const method = String(fn.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": fn.content_type || "application/json",
  };
  if (fn.auth_header) {
    headers.Authorization = fn.auth_header;
  }

  const timeout = Number(fn.timeout_ms) || 5000;
  const url = fn.endpoint_url;
  if (!url) {
    return { error: `Function ${fn.function_name} has no endpoint_url` };
  }

  try {
    const resp = await axios({
      method,
      url,
      headers,
      timeout,
      ...(method === "GET" || method === "DELETE"
        ? { params: args }
        : { data: args }),
    });
    return resp.data;
  } catch (err) {
    console.error(`❌ HTTP tool ${fn.function_name}:`, err.message);
    return {
      error: err.response?.data || err.message || "Tool request failed",
    };
  }
}

module.exports = {
  LOCAL_TOOL_NAMES,
  loadCallConfig,
  buildToolsFromDb,
  buildDynamicInstructions,
  buildDynamicGreeting,
  buildDateTimeVars,
  applyPlaceholders,
  executeHttpTool,
  normalizeFunctionDirection,
  normalizeCallDirection,
  matchesCallDirection,
};
