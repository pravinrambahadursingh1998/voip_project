import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiFunctionPayload } from '../../ai_setup/ai-function/ai-function.models';

@Injectable({
  providedIn: 'root',
})
export class AiFunctionService {
  private readonly apiUrl = `${environment.aiUrl}`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return new HttpHeaders({
      Authorization: `Bearer ${session.token}`,
    });
  }

  getFunctions(query:any): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai-function/list${query}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getFunction(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai-function/get/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  createFunction(payload: AiFunctionPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-function/create`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  updateFunction(id: string, payload: AiFunctionPayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${id}`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteFunction(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  /** Postman-style proxy: send full request config; backend does not load from DB. */
  testFunction(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-function/test`, payload, {
      headers: this.getAuthHeaders(),
    });
  }
}
