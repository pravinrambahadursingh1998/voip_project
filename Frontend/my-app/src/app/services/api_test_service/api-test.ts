import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiTestMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type ApiTestBodyMode = 'none' | 'raw' | 'form-data' | 'x-www-form-urlencoded';
export type ApiTestAuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface ApiTestKeyValue {
  enabled: boolean;
  key: string;
  value: string;
}

export interface ApiTestRequestConfig {
  method: ApiTestMethod;
  url: string;
  params: ApiTestKeyValue[];
  headers: ApiTestKeyValue[];
  bodyMode: ApiTestBodyMode;
  rawBody: string;
  formDataRows: ApiTestKeyValue[];
  urlEncodedRows: ApiTestKeyValue[];
  authType: ApiTestAuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
}

export interface ApiTestHeaderPair {
  key: string;
  value: string;
}

export interface ApiTestResult {
  ok: boolean;
  status: number | null;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  bodyText: string;
  headers: ApiTestHeaderPair[];
  errorMessage: string | null;
}

interface ProxyTestResponse {
  success?: boolean;
  message?: string;
  statusCode?: number | null;
  statusText?: string;
  timeMs?: number;
  sizeBytes?: number;
  headers?: ApiTestHeaderPair[];
  data?: unknown;
  bodyText?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiTestService {
  private readonly apiUrl = `${environment.aiUrl}/ai-function/test`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return new HttpHeaders({
      Authorization: `Bearer ${session.token}`,
    });
  }

  send(config: ApiTestRequestConfig): Observable<ApiTestResult> {
    const url = config.url.trim();
    if (!url) {
      return of({
        ok: false,
        status: null,
        statusText: '',
        timeMs: 0,
        sizeBytes: 0,
        bodyText: '',
        headers: [],
        errorMessage: 'URL is required.',
      });
    }

    const started = performance.now();
    const payload = {
      method: config.method,
      url,
      params: config.params,
      headers: config.headers,
      bodyMode: config.bodyMode,
      rawBody: config.rawBody,
      formDataRows: config.formDataRows,
      urlEncodedRows: config.urlEncodedRows,
      authType: config.authType,
      bearerToken: config.bearerToken,
      basicUsername: config.basicUsername,
      basicPassword: config.basicPassword,
      apiKeyName: config.apiKeyName,
      apiKeyValue: config.apiKeyValue,
      apiKeyIn: config.apiKeyIn,
    };

    return this.http
      .post<ProxyTestResponse>(this.apiUrl, payload, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        map((response) => this.toResult(response, started)),
        catchError((error: unknown) => of(this.toErrorResult(error, started))),
      );
  }

  private toResult(response: ProxyTestResponse, started: number): ApiTestResult {
    const status = response.statusCode ?? null;
    const bodyText =
      response.bodyText ??
      (response.data != null ? this.formatBody(JSON.stringify(response.data)) : '');

    return {
      ok: status != null ? status >= 200 && status < 400 : !!response.success,
      status,
      statusText: response.statusText || '',
      timeMs: response.timeMs ?? Math.round(performance.now() - started),
      sizeBytes: response.sizeBytes ?? this.byteSize(bodyText),
      bodyText: this.formatBody(bodyText),
      headers: Array.isArray(response.headers) ? response.headers : [],
      errorMessage: response.success === false ? response.message || response.error || null : null,
    };
  }

  private toErrorResult(error: unknown, started: number): ApiTestResult {
    const timeMs = Math.round(performance.now() - started);

    if (error instanceof HttpErrorResponse) {
      const payload = (error.error || {}) as ProxyTestResponse;
      const raw =
        payload.bodyText ??
        (typeof error.error === 'string'
          ? error.error
          : error.error != null
            ? JSON.stringify(error.error)
            : error.message || 'Request failed');
      const bodyText = this.formatBody(raw);

      return {
        ok: false,
        status: payload.statusCode ?? error.status ?? null,
        statusText: payload.statusText || error.statusText || 'Error',
        timeMs: payload.timeMs ?? timeMs,
        sizeBytes: payload.sizeBytes ?? this.byteSize(bodyText),
        bodyText,
        headers: Array.isArray(payload.headers) ? payload.headers : [],
        errorMessage:
          payload.message ||
          payload.error ||
          (error.status === 0 ? 'Network error or CORS blocked this request.' : error.message),
      };
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    return {
      ok: false,
      status: null,
      statusText: 'Error',
      timeMs,
      sizeBytes: 0,
      bodyText: message,
      headers: [],
      errorMessage: message,
    };
  }

  private formatBody(raw: string): string {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return raw;
    }
  }

  private byteSize(text: string): number {
    return new TextEncoder().encode(text ?? '').length;
  }
}
