export interface AiFunctionParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export type AiFunctionDirection = 'inbound' | 'outbound' | 'both';

export interface AiFunctionItem {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  type: 'Sync' | 'Async';
  direction: AiFunctionDirection;
  url: string;
  timeout: number;
  enabled: boolean;
  auth: string;
  contentType: string;
  parameters: AiFunctionParameter[];
}

/** Request body expected by POST/PUT /api/ai-function */
export interface AiFunctionPayload {
  id : any
  company_id : any
  user_id : any
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  type: 'Sync' | 'Async';
  direction: AiFunctionDirection;
  url: string;
  timeout: number;
  enabled: boolean;
  headers: {
    Authorization: string;
    'Content-Type': string;
  };
  parameters: AiFunctionParameter[];
}

export const SAMPLE_FUNCTIONS: AiFunctionItem[] = [
  {
    id: 'check_availability',
    name: 'check_availability',
    description: 'Check calendar availability for a given date range',
    method: 'POST',
    type: 'Async',
    direction: 'both',
    url: 'https://api.example.com/v1/calendar/availability',
    timeout: 5000,
    enabled: true,
    auth: 'Bearer YOUR_API_KEY',
    contentType: 'application/json',
    parameters: [
      {
        name: 'start_date',
        type: 'string',
        required: true,
        description: 'Start of availability window (ISO 8601)',
      },
      {
        name: 'end_date',
        type: 'string',
        required: true,
        description: 'End of availability window (ISO 8601)',
      },
      {
        name: 'timezone',
        type: 'string',
        required: false,
        description: 'IANA timezone, defaults to UTC',
      },
    ],
  },
  {
    id: 'book_appointment',
    name: 'book_appointment',
    description: 'Create a new appointment in the CRM calendar',
    method: 'POST',
    type: 'Async',
    direction: 'inbound',
    url: 'https://api.example.com/v1/calendar/book',
    timeout: 5000,
    enabled: true,
    auth: 'Bearer YOUR_API_KEY',
    contentType: 'application/json',
    parameters: [],
  },
  {
    id: 'get_customer',
    name: 'get_customer',
    description: 'Fetch customer profile by phone number',
    method: 'GET',
    type: 'Sync',
    direction: 'both',
    url: 'https://api.example.com/v1/customers',
    timeout: 3000,
    enabled: true,
    auth: 'Bearer YOUR_API_KEY',
    contentType: 'application/json',
    parameters: [],
  },
  {
    id: 'send_sms',
    name: 'send_sms',
    description: 'Send confirmation SMS to the caller',
    method: 'POST',
    type: 'Async',
    direction: 'both',
    url: 'https://api.example.com/v1/sms/send',
    timeout: 5000,
    enabled: true,
    auth: 'Bearer YOUR_API_KEY',
    contentType: 'application/json',
    parameters: [],
  },
  {
    id: 'transfer_call',
    name: 'transfer_call',
    description: 'Warm-transfer the call to a live agent',
    method: 'POST',
    type: 'Sync',
    direction: 'inbound',
    url: 'https://api.example.com/v1/calls/transfer',
    timeout: 8000,
    enabled: true,
    auth: 'Bearer YOUR_API_KEY',
    contentType: 'application/json',
    parameters: [],
  },
];

export function emptyFunction(): AiFunctionItem {
  return {
    id: '',
    name: '',
    description: '',
    method: 'POST',
    type: 'Async',
    direction: 'both',
    url: '',
    timeout: 5000,
    enabled: true,
    auth: '',
    contentType: 'application/json',
    parameters: [],
  };
}
