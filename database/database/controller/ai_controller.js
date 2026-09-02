const axios = require('axios');
const { OpenAI } = require("openai");
const nodemailer = require('nodemailer');
const sessionMemory = {};// Keeps track of date/time per call (UUID)
const fs = require("fs")
const session = require('../session')
const aiQueue = require("../queues/aiQueue");
const { execSync } = require("child_process");
const  aiSetting  = require("../models/ai_setting_modal")
const AiFunction = require("../models/ai_function_modal");
const AiFunctionParameter = require("../models/ai_function_parameter_modal");
const AiPrompt = require("../models/ai_prompt_modal");
const AiIntegration = require("../models/ai_integration_modal");
const Extension = require("../models/v_extensions");
const Gateway = require("../models/gate_way");
const bookshelf = require('../config/bookshelf');
require('dotenv').config();

// OpenDental API
const API_KEY = "5NFqWGJn7dHhG6QT/UxCxmPrzy7xnBpH7"; // your key only
const BASE_URL = "https://api.opendental.com/api/v1";
const headers = {
  "Content-Type": "application/json",
  "Authorization": `ODFHIR ${API_KEY}` // correct format!
};
// ODFHIR 5NFqWGJn7dHhG6QT/ahjWIkhXR4qAvIUF
// OpenAI setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fetchModels = async (req, res) => {
  try {

    const { provider, api_key } = req.body;

    if (!provider || !api_key) {
      return res.status(400).json({
        success: false,
        message: 'Provider and API key are required'
      });
    }

    let models = [];

    switch (provider) {

      case 'openai':

        const openai = await axios.get(
          'https://api.openai.com/v1/models',
          {
            headers: {
              Authorization: `Bearer ${api_key}`
            }
          }
        );

        models = openai.data.data.map(model => ({
          id: model.id,
          name: model.id
        }));

        break;

      case 'anthropic':

        const anthropic = await axios.get(
          'https://api.anthropic.com/v1/models',
          {
            headers: {
              'x-api-key': api_key,
              'anthropic-version': '2023-06-01'
            }
          }
        );

        models = anthropic.data.data.map(model => ({
          id: model.id,
          name: model.display_name
        }));

        break;

      case 'gemini':

        const gemini = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`
        );

        models = gemini.data.models.map(model => ({
          id: model.name,
          name: model.displayName
        }));

        break;

      case 'groq':

        const groq = await axios.get(
          'https://api.groq.com/openai/v1/models',
          {
            headers: {
              Authorization: `Bearer ${api_key}`
            }
          }
        );

        models = groq.data.data.map(model => ({
          id: model.id,
          name: model.id
        }));

        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported provider'
        });

    }

    return res.json({
      success: true,
      data: models,
      message: 'Connection successful'
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: 'Invalid API key or provider.',
      error: error
    });

  }

};

//  Create a new Record
const addAiSeeting = async (req, res) => {
  try {
    console.log('req.body', req.body);

    const created_at = new Date();

    const aiSettings = new aiSetting({
      company_id: !!req.body.company_id ? req.body.company_id : null,
      ai_provider: !!req.body.provider ? req.body.provider : null,
      api_key: !!req.body.api_key ? req.body.api_key : null,
      base_url: !!req.body.base_url ? req.body.base_url : null,
      model: !!req.body.model ? req.body.model : null,
      temperature: !!req.body.temperature ? req.body.temperature : null,
      max_tokens: !!req.body.max_tokens ? req.body.max_tokens : null,
      confidence_threshold: !!req.body.confidence_threshold ? req.body.confidence_threshold : null,
      similarity_threshold: !!req.body.similarity_threshold ? req.body.similarity_threshold : null,
      od_slots_path: !!req.body.od_slots_path ? req.body.od_slots_path : null,
      created_by: !!req.body.user_id ? req.body.user_id : null,
      created_at: created_at
    });

    await aiSettings.save();

    return res.status(200).json({
      success: true,
      message: 'AI setting added successfully.',
      
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

// Fetch All record
const getAiSettingList = async (req, res) => {
  try {
    const page = !!req.query.page ? parseInt(req.query.page) : 1;
    const perPage = !!req.query.perPage ? parseInt(req.query.perPage) : 10;

    const where = {};

    if (!!req.query.company_id && req.query.company_id !== 'null') {
      where.company_id = req.query.company_id;
    }

    const list = await aiSetting
      .where(where)
      .fetchPage({
        page: page,
        pageSize: perPage,
        withRelated: [],
        require: false
      });

    return res.status(200).json({
      success: true,
      message: "AI settings fetched successfully.",
      data: list.toJSON(),
      pagination: list.pagination
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};

// Get singl record
const getAiSettingById = async (req, res) => {
  try {
    const id = req.params.id || req.body?.id;
    const where = { id: id };
    const company_id = req.query?.company_id || req.body?.company_id;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      where.company_id = company_id;
    }

    const setting = await aiSetting
      .where(where)
      .fetch({
        require: false
      });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'AI setting not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'AI setting fetched successfully.',
      data: setting.toJSON()
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

// Update the setting record
const updateAiSetting = async (req, res) => {
  try {
    const updated_at = new Date();
    const id = req.params.id || req.body?.id;
    const where = { id: id };
    const company_id = req.body?.company_id || req.query?.company_id;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      where.company_id = company_id;
    }

    const setting = await aiSetting
      .where(where)
      .fetch({
        require: false
      });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'AI setting not found.'
      });
    }

    await setting.save(
      {
        ai_provider: req.body?.provider !== undefined ? req.body.provider : (req.body?.ai_provider !== undefined ? req.body.ai_provider : setting.attributes.ai_provider),
        api_key: req.body?.api_key !== undefined ? req.body.api_key : setting.attributes.api_key,
        base_url: req.body?.base_url !== undefined ? req.body.base_url : setting.attributes.base_url,
        model: req.body?.model !== undefined ? req.body.model : setting.attributes.model,
        temperature: req.body?.temperature !== undefined ? req.body.temperature : setting.attributes.temperature,
        max_tokens: req.body?.max_tokens !== undefined ? req.body.max_tokens : setting.attributes.max_tokens,
        confidence_threshold: req.body?.confidence_threshold !== undefined
          ? req.body.confidence_threshold
          : setting.attributes.confidence_threshold,
        similarity_threshold: req.body?.similarity_threshold !== undefined
          ? req.body.similarity_threshold
          : setting.attributes.similarity_threshold,
        od_slots_path: req.body?.od_slots_path !== undefined
          ? req.body.od_slots_path
          : setting.attributes.od_slots_path,
        updated_by: req.body?.user_id !== undefined ? req.body.user_id : setting.attributes.updated_by,
        updated_at: updated_at
      },
      {
        patch: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'AI setting updated successfully.',
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

//Delete the ai setting
const deleteAiSetting = async (req, res) => {
  try {
    const id = req.params.id || req.body?.id;
    const where = { id: id };
    const company_id = req.body?.company_id || req.query?.company_id;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      where.company_id = company_id;
    }

    const setting = await aiSetting
      .where(where)
      .fetch({
        require: false
      });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'AI setting not found.'
      });
    }

    await setting.destroy();

    return res.status(200).json({
      success: true,
      message: 'AI setting deleted successfully.'
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};


const normalizeFunctionDirection = (value) => {
  const direction = String(value || 'both').toLowerCase();
  if (['inbound', 'outbound', 'both'].includes(direction)) {
    return direction;
  }
  return 'both';
};

// -------------------- Create / Update AI Function --------------------
const createAiFunction = async (req, res) => {
  const trx = await bookshelf.transaction();

  try {
    console.log('req.body354', req.body);
    const created_at = new Date();
    const company_id = req.body.company_id ?? null;
    const function_name = req.body.name ? String(req.body.name).trim() : null;
    const direction = normalizeFunctionDirection(req.body.direction);

    if (!function_name) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Function name is required.',
      });
    }

    // Check duplicate function name (allow same name when updating self)
    const existingFunction = await AiFunction
      .where({
        company_id,
        function_name,
      })
      .fetch({
        require: false,
        transacting: trx,
      });

    if (
      existingFunction &&
      String(existingFunction.get('id')) !== String(req.body.id || '')
    ) {
      await trx.rollback();

      return res.status(400).json({
        success: false,
        message: 'Function name already exists.',
      });
    }

    const functionFields = {
      company_id,
      function_name,
      description: !!req.body.description ? req.body.description : null,
      method: !!req.body.method ? req.body.method : null,
      endpoint_url: !!req.body.url ? req.body.url : null,
      execution_type: !!req.body.type ? req.body.type : null,
      timeout_ms: !!req.body.timeout ? req.body.timeout : 5000,
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
      direction,
      auth_header: req.body.headers?.Authorization
        ? req.body.headers.Authorization
        : null,
      content_type: req.body.headers?.['Content-Type']
        ? req.body.headers['Content-Type']
        : 'application/json',
    };

    let functionData;
    let functionId;
    const isUpdate = !!req.body.id;

    if (isUpdate) {
      functionData = await AiFunction.where({ id: req.body.id }).fetch({
        require: false,
        transacting: trx,
      });

      if (!functionData) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: 'AI Function not found.',
        });
      }

      await functionData.save(
        {
          ...functionFields,
        },
        { patch: true, transacting: trx }
      );

      functionId = functionData.get('id');

      // Replace parameters on update
      await bookshelf.knex('ai_function_parameters')
        .transacting(trx)
        .where({ function_id: functionId })
        .del();
    } else {
      functionData = await new AiFunction({
        ...functionFields,
        created_by: !!req.body.user_id ? req.body.user_id : null,
        created_at: created_at,
      }).save(null, { transacting: trx });

      functionId = functionData.get('id');
    }

    if (Array.isArray(req.body.parameters) && req.body.parameters.length > 0) {
      for (let i = 0; i < req.body.parameters.length; i++) {
        const param = req.body.parameters[i];

        await new AiFunctionParameter({
          function_id: functionId,
          parameter_name: !!param.name ? param.name : null,
          parameter_type: !!param.type ? param.type : null,
          is_required:
            param.required !== undefined ? param.required : false,
          description: !!param.description ? param.description : null,
          sort_order: i + 1,
        }).save(null, { transacting: trx });
      }
    }

    await trx.commit();

    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? 'AI Function updated successfully.'
        : 'AI Function created successfully.',
      data: functionData,
    });

  } catch (error) {
    await trx.rollback();

    console.log('createAiFunction error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getAiFunctions = async (req, res) => {
  try {
    const company_id = req.query.company_id;

    let query = AiFunction;

    if (company_id) {
      query = query.where({ company_id });
    }

    const functions = await query.fetchAll({
      withRelated: ['parameters']
    });

    const data = functions.toJSON().map((item) => ({
      id: item.id,
      company_id: item.company_id,
      name: item.function_name,
      description: item.description,
      method: item.method,
      url: item.endpoint_url,
      type: item.execution_type,
      timeout: item.timeout_ms,
      enabled: item.enabled,
      direction: normalizeFunctionDirection(item.direction),
      headers: {
        Authorization: item.auth_header,
        'Content-Type': item.content_type
      },
      parameters: item.parameters.map((param) => ({
        id: param.id,
        name: param.parameter_name,
        type: param.parameter_type,
        required: param.is_required,
        description: param.description,
        sort_order: param.sort_order
      }))
    }));

    return res.status(200).json({
      success: true,
      message: 'AI Functions fetched successfully.',
      data
    });

  } catch (error) {
    console.log('getAiFunctions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

const getAiFunction = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Function id is required.',
      });
    }

    const functionData = await AiFunction.where({ id }).fetch({
      withRelated: ['parameters'],
      require: false,
    });

    if (!functionData) {
      return res.status(404).json({
        success: false,
        message: 'AI Function not found.',
      });
    }

    const item = functionData.toJSON();

    const data = {
      id: item.id,
      company_id: item.company_id,
      name: item.function_name,
      description: item.description,
      method: item.method,
      url: item.endpoint_url,
      type: item.execution_type,
      timeout: item.timeout_ms,
      enabled: item.enabled,
      direction: normalizeFunctionDirection(item.direction),
      headers: {
        Authorization: item.auth_header,
        'Content-Type': item.content_type
      },
      parameters: (item.parameters || []).map((param) => ({
        id: param.id,
        name: param.parameter_name,
        type: param.parameter_type,
        required: param.is_required,
        description: param.description,
        sort_order: param.sort_order
      }))
    };

    return res.status(200).json({
      success: true,
      message: 'AI Function fetched successfully.',
      data
    });

  } catch (error) {
    console.log('getAiFunction error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message
    });
  }
};

const pickEnabledPairs = (rows = []) => {
  const result = {};
  for (const row of rows) {
    if (!row || row.enabled === false) continue;
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    result[key] = row.value ?? '';
  }
  return result;
};

const buildMultipartBody = (rows = []) => {
  const boundary = `----VoipApiTestBoundary${Date.now()}`;
  let body = '';

  for (const row of rows) {
    if (!row || row.enabled === false) continue;
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    const value = row.value ?? '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }

  body += `--${boundary}--\r\n`;
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

const formatResponseBody = (data) => {
  if (data == null) return '';
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return data;
    }
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const byteSize = (text) => Buffer.byteLength(text ?? '', 'utf8');

const mapAxiosHeaders = (headers = {}) =>
  Object.entries(headers).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
  }));

/**
 * Postman-style proxy: execute the request exactly as provided in the payload.
 * Does not load anything from the database.
 */
const testAiFunction = async (req, res) => {
  const started = Date.now();

  try {
    const {
      method: rawMethod,
      url,
      params = [],
      headers: headerRows = [],
      bodyMode = 'none',
      rawBody = '',
      formDataRows = [],
      urlEncodedRows = [],
      authType = 'none',
      bearerToken = '',
      basicUsername = '',
      basicPassword = '',
      apiKeyName = '',
      apiKeyValue = '',
      apiKeyIn = 'header',
      timeout_ms,
      timeout,
    } = req.body || {};

    if (!url || !String(url).trim()) {
      return res.status(400).json({
        success: false,
        message: 'URL is required.',
      });
    }

    const method = String(rawMethod || 'GET').toUpperCase();
    const requestTimeout = Number(timeout_ms || timeout || 30000);
    const queryParams = pickEnabledPairs(params);
    const headers = pickEnabledPairs(headerRows);

    if (authType === 'bearer' && String(bearerToken).trim()) {
      headers.Authorization = `Bearer ${String(bearerToken).trim()}`;
    }

    if (authType === 'basic') {
      const token = Buffer.from(`${basicUsername}:${basicPassword}`).toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    if (authType === 'api-key' && String(apiKeyName).trim()) {
      if (apiKeyIn === 'query') {
        queryParams[String(apiKeyName).trim()] = apiKeyValue ?? '';
      } else {
        headers[String(apiKeyName).trim()] = apiKeyValue ?? '';
      }
    }

    let data;

    if (bodyMode === 'raw') {
      data = rawBody ?? '';
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (bodyMode === 'form-data') {
      const multipart = buildMultipartBody(formDataRows);
      data = multipart.body;
      // Always set boundary from our builder
      Object.keys(headers).forEach((key) => {
        if (key.toLowerCase() === 'content-type') delete headers[key];
      });
      headers['Content-Type'] = multipart.contentType;
    } else if (bodyMode === 'x-www-form-urlencoded') {
      const encoded = new URLSearchParams();
      for (const row of urlEncodedRows) {
        if (!row || row.enabled === false) continue;
        const key = String(row.key ?? '').trim();
        if (!key) continue;
        encoded.append(key, row.value ?? '');
      }
      data = encoded.toString();
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    const axiosConfig = {
      method,
      url: String(url).trim(),
      headers,
      params: queryParams,
      timeout: requestTimeout,
      validateStatus: () => true,
      // Keep raw text so UI can mirror Postman body view
      transformResponse: [(body) => body],
      responseType: 'text',
    };

    // Methods that typically omit a body
    if (!['GET', 'HEAD'].includes(method) && bodyMode !== 'none') {
      axiosConfig.data = data;
    }

    const response = await axios(axiosConfig);
    const timeMs = Date.now() - started;
    const bodyText = formatResponseBody(response.data);
    let parsedData = response.data;

    try {
      parsedData = JSON.parse(response.data);
    } catch {
      parsedData = response.data;
    }

    return res.status(200).json({
      success: true,
      message: 'Request completed.',
      statusCode: response.status,
      statusText: response.statusText || '',
      timeMs,
      sizeBytes: byteSize(bodyText),
      headers: mapAxiosHeaders(response.headers),
      data: parsedData,
      bodyText,
    });
  } catch (error) {
    console.log('testAiFunction error:', error);
    const timeMs = Date.now() - started;

    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: 'Request timed out.',
        timeMs,
        error: error.message,
      });
    }

    if (error.response) {
      const bodyText = formatResponseBody(error.response.data);
      return res.status(200).json({
        success: true,
        message: 'Request completed.',
        statusCode: error.response.status,
        statusText: error.response.statusText || '',
        timeMs,
        sizeBytes: byteSize(bodyText),
        headers: mapAxiosHeaders(error.response.headers),
        data: error.response.data,
        bodyText,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong.',
      timeMs,
      statusCode: null,
      data: null,
      bodyText: error.message || 'Something went wrong.',
      error: error.message,
    });
  }
};




const greet = async (req, res) => {
  try {
    console.log('req.query', req.query);

    const uuid = req.query.uuid;
    const output = `/tmp/ai_greet_${uuid}.wav`;
    const rawFile = `/tmp/raw_greet_${uuid}.wav`; // ✅ ADD THIS

    let username = "Hello";

    try {
      const { data } = await axios.get(
        `${BASE_URL}/patients?Phone=${encodeURIComponent(req.query.caller)}`,
        { headers, timeout: 3000 }
      );
      console.log('data', data);


      if (data?.length > 0) {
        const p = data[0];
        username = `Hello ${p.FName}`;

        await session.set(uuid, {
          patientData: {
            patNum: p.PatNum,
            patientName: `${p.FName} ${p.LName}`.trim(),
            patient_dob: p.Birthdate
          },
          date: null,
          time: null,
          slots: []
        });
      }
    } catch (_) { }

    const greeting = `${username}, welcome to Smile Center. How can I help you today? You can say book appointment, cancel appointment, or reschedule.`;

    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: greeting,
      response_format: "wav"
    });

    // ✅ Step 1: save RAW (24000 Hz)
    fs.writeFileSync(output, Buffer.from(await speech.arrayBuffer()));

    console.log("✅ Greeting converted to 8000 Hz");

    res.send("OK");

  } catch (err) {
    console.error("Greet Error:", err);
    res.status(500).send("AI failed");
  }
};



const aiAgent = async (req, res) => {
  try {
    const uuid = req.query.uuid;
    const callerPhone = req.query.caller || "Unknown";

    if (!uuid) return res.status(400).send("Missing UUID");

    // Save audio to disk
    if (!req.body || req.body.length < 100) {
      console.log("⚠️ Empty audio received");
      return res.send("OK");
    }

    const inputPath = `/tmp/ai_input_${uuid}.wav`;
    fs.writeFileSync(inputPath, req.body);
    console.log(`✅ Audio saved (${req.body.length} bytes) — queuing job`);

    // Add to queue and WAIT for the result
    const job = await aiQueue.add({ uuid, inputPath, callerPhone });
    console.log(`[Queue] Job ${job.id} added for UUID: ${uuid}`);

    // Wait until the worker finishes (TTS written to disk)
    const result = await job.finished();
    console.log(`[Queue] Job ${job.id} finished`);

    res.json({ status: "OK", hangup: result?.hangup || false })

  } catch (err) {
    console.error("aiAgent error:", err.message);
    res.status(500).send("AI failed");
  }
};



const checkAvailability = async (req, res) => {
  try {
    const { appointment_type, date, provider, operatory_num } = req.query;

    // Fetch all appointments for the date
    const resp = await axios.get(`${BASE_URL}/appointments/Slots`, {
      headers,
      params: {
        date: date,
        // lengthMinutes: minutes,
        // ProvNum,
        // OpNum
      }
    });

    const bookedAppointments = resp.data || [];

    // Convert booked appointments into slots
    const slots = bookedAppointments.map(a => {
      console.log('availble:', a);

      const start = new Date(a.DateTimeStart);
      // const end = new Date(start.getTime() + minutes * 60000); // add appointment length
      const end = new Date(a.DateTimeEnd);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        provider: a.ProvNum || ProvNum,
        operatory: a.OpNum || OpNum
      };
    });

    console.log('slots:', slots);


    res.json({ slots });

  } catch (err) {
    console.error("Error fetching availability:", err.response?.data || err.message);
    res.status(500).json({ slots: [] });
  }
}


// -------------------- /chat/appointment/book --------------------
const bookappointment = async (req, res) => {
  try {
    console.log('req.body:', req.body);
    //  return
    if (req.body && req.body.patientId && req.body.providerId && req.body.appointmentDateTime) {
      const { patientId, providerId, appointmentDateTime, operatory, email } = req.body;
      const note = req.body.notes || 'Scheduled by chat agent';

      if (!patientId || !providerId || !appointmentDateTime) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const startISO = new Date(appointmentDateTime);
      const endISO = new Date(startISO.getTime() + 30 * 60000);

      const payload = {
        AptDateTime: startISO.toISOString(),
        // AptDateTimeEnd: endISO.toISOString(),
        PatNum: Number(patientId),
        ProvNum: Number(providerId),
        Pattern: minutesToPattern(startISO.toISOString(), endISO.toISOString()),
        Op: operatory,
        Note: note,
        email: email
      };
      console.log('payload', payload);
      try {
        console.time("OD_POST");
        const created = await axios.post(
          `${BASE_URL}/appointments`,
          payload,
          { headers }
        );
        console.timeEnd("OD_POST");
        const result = {
          success: true,
          appointment: {
            appointment_id: created.data?.AptNum || created.data?.AppointmentNum || created.data?.AptNumNew || null,
            status: 'booked',
            provider: providerId,
            start: payload.AptDateTime,
            end: payload.AptDateTimeEnd,
            email: payload.email
          }
        };

        try {
          await sendBookingEmail(result.appointment);
        } catch (e) {
          console.error('Email send failed (chat quick):', e.message);
        }

        return res.json(result);
      } catch (e) {
        console.error("Error booking via quick payload:", e.response?.data || e.message);
        return res.status(500).json({ error: "Failed to book appointment" });
      }
    }
    else {
      console.log('Missing Parameter require461');

    }

  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ error: err.message });
  }
};

function minutesToPattern(startISO, endISO) {
  const start = new Date(startISO), end = new Date(endISO)
  const mins = Math.max(15, Math.round((end - start) / 60000))
  return '/'.repeat(Math.round(mins / 15)) // 15-min units
}


async function sendBookingEmail(appt) {
  console.log('Sending booking email for appointment:', appt);

  if (!appt || appt.status !== 'booked') return;

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // const to = 'pravinrambahadursingh1998@gmail.com , shreedhar.solution@gmail.com , ${appt.email}';
  const to = `pravinrambahadursingh1998@gmail.com, shreedhar.solution@gmail.com${appt.email ? ',' + appt.email : ''}`;
  const subject = `Appointment booked: #${appt.appointment_id || ''}`.trim();
  const startLocal = appt.start ? new Date(appt.start).toLocaleString() : '';
  const text = `Your appointment has been booked.\n\n` +
    `Appointment ID: ${appt.appointment_id || 'N/A'}\n` +
    `Provider: ${appt.provider || 'N/A'}\n` +
    `Start: ${startLocal}\n` +
    (appt.end ? `End: ${new Date(appt.end).toLocaleString()}\n` : '') +
    `Status: ${appt.status}`;

  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
}


const createAiPrompt = async (req, res) => {
  try {
    const created_at = new Date();
    const company_id = req.body.company_id ?? null;
    const name = req.body.name ? String(req.body.name).trim() : null;
    const extension = req.body.extension ? String(req.body.extension).trim() : null;

    if (!name || !extension || !req.body.prompt) {
      return res.status(400).json({
        success: false,
        message: 'Name, extension, and prompt are required.',
      });
    }

    const existing = await AiPrompt.where({
      company_id,
      prompt_name: name,
      extension,
    }).fetch({ require: false });

    if (existing && String(existing.get('id')) !== String(req.body.id || '')) {
      return res.status(400).json({
        success: false,
        message: 'A prompt with this name already exists for this extension.',
      });
    }

    let promptData;

    if (req.body.id) {
      promptData = await AiPrompt.where({ id: req.body.id }).fetch({
        require: false,
      });

      if (!promptData) {
        return res.status(404).json({
          success: false,
          message: 'AI Prompt not found.',
        });
      }

      await promptData.save(
        {
          company_id,
          prompt_name: name,
          extension,
          introduction: req.body.introduction
            ? String(req.body.introduction).trim()
            : null,
          prompt_body: String(req.body.prompt).trim(),
          enabled: req.body.enabled !== undefined ? !!req.body.enabled : true,
          updated_at: created_at,
        },
        { patch: true }
      );
    } else {
      promptData = await new AiPrompt({
        company_id,
        prompt_name: name,
        extension,
        introduction: req.body.introduction
          ? String(req.body.introduction).trim()
          : null,
        prompt_body: String(req.body.prompt).trim(),
        enabled: req.body.enabled !== undefined ? !!req.body.enabled : true,
        created_by: req.body.user_id ?? null,
        created_at,
        updated_at: created_at,
      }).save();
    }

    const item = promptData.toJSON();

    return res.status(req.body.id ? 200 : 201).json({
      success: true,
      message: req.body.id
        ? 'AI Prompt updated successfully.'
        : 'AI Prompt created successfully.',
      data: {
        id: item.id,
        company_id: item.company_id,
        name: item.prompt_name,
        extension: item.extension,
        introduction: item.introduction,
        prompt: item.prompt_body,
        enabled: item.enabled,
      },
    });
  } catch (error) {
    console.log('createAiPrompt error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getAiPrompts = async (req, res) => {
  try {
    const company_id = req.query.company_id;

    let query = AiPrompt;

    if (company_id) {
      query = query.where({ company_id });
    }

    const prompts = await query.fetchAll();

    const data = prompts.toJSON().map((item) => ({
      id: item.id,
      company_id: item.company_id,
      name: item.prompt_name,
      extension: item.extension,
      introduction: item.introduction,
      prompt: item.prompt_body,
      enabled: item.enabled,
    }));

    return res.status(200).json({
      success: true,
      message: 'AI Prompts fetched successfully.',
      data,
    });
  } catch (error) {
    console.log('getAiPrompts error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getAiPrompt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Prompt id is required.',
      });
    }

    const promptData = await AiPrompt.where({ id }).fetch({
      require: false,
    });

    if (!promptData) {
      return res.status(404).json({
        success: false,
        message: 'AI Prompt not found.',
      });
    }

    const item = promptData.toJSON();

    return res.status(200).json({
      success: true,
      message: 'AI Prompt fetched successfully.',
      data: {
        id: item.id,
        company_id: item.company_id,
        name: item.prompt_name,
        extension: item.extension,
        introduction: item.introduction,
        prompt: item.prompt_body,
        enabled: item.enabled,
      },
    });
  } catch (error) {
    console.log('getAiPrompt error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const deleteAiPrompt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Prompt id is required.',
      });
    }

    const promptData = await AiPrompt.where({ id }).fetch({
      require: false,
    });

    if (!promptData) {
      return res.status(404).json({
        success: false,
        message: 'AI Prompt not found.',
      });
    }

    await promptData.destroy();

    return res.status(200).json({
      success: true,
      message: 'AI Prompt deleted successfully.',
    });
  } catch (error) {
    console.log('deleteAiPrompt error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getExtensionList = async (req, res) => {
  try {
    const company_id = req.query?.company_id || req.body?.company_id || null;
    const extensionSet = new Set();
    const result = [];

    // 1. Try to fetch from extensions / v_extensions table if it exists
    try {
      const hasExtensions = await bookshelf.knex.schema.hasTable('extensions');
      if (hasExtensions) {
        let extQuery = Extension;
        if (company_id && company_id !== 'null' && company_id !== 'undefined') {
          extQuery = extQuery.where({ company_id });
        }
        const extRecords = await extQuery.fetchAll({ require: false });
        if (extRecords) {
          extRecords.toJSON().forEach((item) => {
            const val = String(item.extension || '').trim();
            if (val && !extensionSet.has(val)) {
              extensionSet.add(val);
              result.push({
                value: val,
                label: item.description ? `${val} — ${item.description}` : val,
              });
            }
          });
        }
      } else {
        const hasVExtensions = await bookshelf.knex.schema.hasTable('v_extensions');
        if (hasVExtensions) {
          const q = bookshelf.knex('v_extensions');
          if (company_id && company_id !== 'null' && company_id !== 'undefined') {
            q.where({ company_id });
          }
          const rows = await q;
          (rows || []).forEach((item) => {
            const val = String(item.extension || '').trim();
            if (val && !extensionSet.has(val)) {
              extensionSet.add(val);
              result.push({
                value: val,
                label: item.description ? `${val} — ${item.description}` : val,
              });
            }
          });
        }
      }
    } catch (extErr) {
      console.log('Notice: extensions table query skipped:', extErr.message);
    }

    // 2. Fetch extensions configured on Gateways (v_gateways)
    try {
      const hasGateways = await bookshelf.knex.schema.hasTable('v_gateways');
      if (hasGateways) {
        let gwQuery = Gateway;
        if (company_id && company_id !== 'null' && company_id !== 'undefined') {
          gwQuery = gwQuery.where({ company_id });
        }
        const gwRecords = await gwQuery.fetchAll({ require: false });
        if (gwRecords) {
          gwRecords.toJSON().forEach((item) => {
            const val = String(item.extension || '').trim();
            if (val && !extensionSet.has(val)) {
              extensionSet.add(val);
              result.push({
                value: val,
                label: item.gateway_name ? `${val} — Gateway: ${item.gateway_name}` : val,
              });
            }
          });
        }
      }
    } catch (gwErr) {
      console.log('Notice: gateways extension query skipped:', gwErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Extensions fetched successfully.',
      data: result,
    });
  } catch (error) {
    console.log('getExtensionList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch extensions',
      error: error.message,
    });
  }
};

// -------------------- AI Integrations (OpenDental, etc.) --------------------
const createAiIntegration = async (req, res) => {
  try {
    const created_at = new Date();
    const company_id = req.body.company_id ?? null;
    const provider = req.body.provider ? String(req.body.provider).trim() : 'opendental';
    const api_key = req.body.api_key ? String(req.body.api_key).trim() : null;
    const base_url = req.body.base_url ? String(req.body.base_url).trim() : 'https://api.opendental.com/api/v1';
    const extension = req.body.extension ? String(req.body.extension).trim() : null;
    const is_active = req.body.is_active !== undefined ? !!req.body.is_active : true;
    const user_id = req.body.user_id ?? null;

    if (!provider || !api_key || !base_url) {
      return res.status(400).json({
        success: false,
        message: 'Provider, API Key, and Base URL are required.',
      });
    }

    let integrationData;
    const isUpdate = !!req.body.id;

    if (isUpdate) {
      integrationData = await AiIntegration.where({ id: req.body.id }).fetch({
        require: false,
      });

      if (!integrationData) {
        return res.status(404).json({
          success: false,
          message: 'AI Integration not found.',
        });
      }

      await integrationData.save(
        {
          company_id: company_id !== undefined ? company_id : integrationData.get('company_id'),
          provider,
          api_key,
          base_url,
          extension,
          is_active,
          updated_by: user_id,
          updated_at: created_at,
        },
        { patch: true }
      );
    } else {
      integrationData = await new AiIntegration({
        company_id,
        provider,
        api_key,
        base_url,
        extension,
        is_active,
        created_by: user_id,
        created_at,
        updated_at: created_at,
      }).save();
    }

    const item = integrationData.toJSON();

    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? 'AI Integration updated successfully.'
        : 'AI Integration created successfully.',
      data: {
        id: item.id,
        company_id: item.company_id,
        provider: item.provider,
        api_key: item.api_key,
        base_url: item.base_url,
        extension: item.extension,
        is_active: !!item.is_active,
      },
    });
  } catch (error) {
    console.log('createAiIntegration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getAiIntegrations = async (req, res) => {
  try {
    const company_id = req.query.company_id;

    let query = AiIntegration;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      query = query.where(function () {
        this.where('company_id', company_id).orWhereNull('company_id');
      });
    }

    const integrations = await query.fetchAll({ require: false });
    const data = (integrations ? integrations.toJSON() : []).map((item) => ({
      id: item.id,
      company_id: item.company_id,
      provider: item.provider,
      api_key: item.api_key,
      base_url: item.base_url,
      extension: item.extension,
      is_active: !!item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return res.status(200).json({
      success: true,
      message: 'AI Integrations fetched successfully.',
      data,
    });
  } catch (error) {
    console.log('getAiIntegrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const getAiIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Integration id is required.',
      });
    }

    const where = { id };
    const company_id = req.query.company_id;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      where.company_id = company_id;
    }

    const record = await AiIntegration.where(where).fetch({ require: false });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'AI Integration not found.',
      });
    }

    const item = record.toJSON();
    return res.status(200).json({
      success: true,
      message: 'AI Integration fetched successfully.',
      data: {
        id: item.id,
        company_id: item.company_id,
        provider: item.provider,
        api_key: item.api_key,
        base_url: item.base_url,
        extension: item.extension,
        is_active: !!item.is_active,
      },
    });
  } catch (error) {
    console.log('getAiIntegration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const updateAiIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const updated_at = new Date();

    const record = await AiIntegration.where({ id }).fetch({ require: false });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'AI Integration not found.',
      });
    }

    await record.save(
      {
        provider: req.body.provider !== undefined ? req.body.provider : record.get('provider'),
        api_key: req.body.api_key !== undefined ? req.body.api_key : record.get('api_key'),
        base_url: req.body.base_url !== undefined ? req.body.base_url : record.get('base_url'),
        extension: req.body.extension !== undefined ? req.body.extension : record.get('extension'),
        is_active: req.body.is_active !== undefined ? !!req.body.is_active : record.get('is_active'),
        updated_by: req.body.user_id ?? null,
        updated_at,
      },
      { patch: true }
    );

    return res.status(200).json({
      success: true,
      message: 'AI Integration updated successfully.',
    });
  } catch (error) {
    console.log('updateAiIntegration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

const deleteAiIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Integration id is required.',
      });
    }

    const record = await AiIntegration.where({ id }).fetch({ require: false });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'AI Integration not found.',
      });
    }

    await record.destroy();

    return res.status(200).json({
      success: true,
      message: 'AI Integration deleted successfully.',
    });
  } catch (error) {
    console.log('deleteAiIntegration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong.',
      error: error.message,
    });
  }
};

// Fetch extensions specifically from Gateway table (v_gateways)
const getGatewayExtensions = async (req, res) => {
  try {
    const company_id = req.query?.company_id || req.body?.company_id || null;
    let gwQuery = Gateway;
    if (company_id && company_id !== 'null' && company_id !== 'undefined') {
      gwQuery = gwQuery.where({ company_id });
    }

    const gwRecords = await gwQuery.fetchAll({ require: false });
    const extensionSet = new Set();
    const result = [];

    if (gwRecords) {
      gwRecords.toJSON().forEach((item) => {
        const val = String(item.extension || '').trim();
        if (val && !extensionSet.has(val)) {
          extensionSet.add(val);
          result.push({
            value: val,
            label: item.gateway_name ? `${val} — Gateway: ${item.gateway_name}` : val,
            gateway_name: item.gateway_name || null,
          });
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Gateway extensions fetched successfully.',
      data: result,
    });
  } catch (error) {
    console.log('getGatewayExtensions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gateway extensions',
      error: error.message,
    });
  }
};

module.exports = {
  aiAgent, greet,
  checkAvailability, bookappointment,
   fetchModels, addAiSeeting, getAiSettingList, getAiSettingById, updateAiSetting, deleteAiSetting,
   createAiFunction, getAiFunctions, getAiFunction, testAiFunction,
   createAiPrompt, getAiPrompts, getAiPrompt, deleteAiPrompt,
   getExtensionList,
   createAiIntegration, getAiIntegrations, getAiIntegration, updateAiIntegration, deleteAiIntegration,
   getGatewayExtensions
}
