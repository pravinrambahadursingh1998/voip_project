import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiPromptPayload } from '../../ai_setup/ai-prompt/ai-prompt.models';

@Injectable({
  providedIn: 'root',
})
export class AiPromptService {
  private readonly apiUrl = `${environment.aiUrl}`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return new HttpHeaders({
      Authorization: `Bearer ${session.token}`,
    });
  }

  getPrompts(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai-prompt/list${query}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getPrompt(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai-prompt/get/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  createPrompt(payload: AiPromptPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-prompt/create`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  deletePrompt(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ai-prompt/delete/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getExtensions(query: string = ''): Observable<any> {
    return this.http.get(`${this.apiUrl}/extensions/list${query}`, {
      headers: this.getAuthHeaders(),
    });
  }
}
