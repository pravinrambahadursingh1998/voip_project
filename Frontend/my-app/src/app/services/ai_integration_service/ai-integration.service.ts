import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AiIntegrationService {
  private readonly apiUrl = `${environment.aiUrl}`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return new HttpHeaders({
      Authorization: `Bearer ${session.token}`,
    });
  }

  getIntegrations(companyId?: any): Observable<any> {
    const params: any = {};
    if (companyId) {
      params.company_id = companyId;
    }
    return this.http.get(`${this.apiUrl}/ai-integration/list`, {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  getIntegration(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai-integration/get/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  createIntegration(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-integration/create`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  updateIntegration(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/ai-integration/update/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteIntegration(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ai-integration/delete/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getGatewayExtensions(companyId?: any): Observable<any> {
    const params: any = {};
    if (companyId) {
      params.company_id = companyId;
    }
    return this.http.get(`${this.apiUrl}/ai-integration/gateway-extensions`, {
      headers: this.getAuthHeaders(),
      params,
    });
  }
}
