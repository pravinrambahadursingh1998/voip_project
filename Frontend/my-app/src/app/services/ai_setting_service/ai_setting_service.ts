import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth';

@Injectable({
  providedIn: 'root'
})
export class AiSettingService {
  private apiUrl = environment.aiUrl;

  constructor(private http: HttpClient, private authService: AuthService) { }
  getAuthHeaders(): HttpHeaders {
    const session = JSON.parse(localStorage.getItem('session') || '{}');

    return new HttpHeaders({
      Authorization: `Bearer ${session.token}`
    });
  };

  //Get AI Modals
  getAiModals(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/models`, data,
      { headers: this.getAuthHeaders() });
  }

  // Testing the ai connection
  testConnection(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/models`, data,
      { headers: this.getAuthHeaders() });
  }

  //Add Ai setting
  addAiSettings(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai_settings`, data,
      { headers: this.getAuthHeaders() });
  }
  //Get Ai settings list
  getAiSettingsList(data: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai_settings/list`,
      { headers: this.getAuthHeaders(), params: data });
  }

  getAiSettingById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai_settings/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  //Update Ai setting
  updateAiSettings(id: any, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/ai_settings/${id}`, data,
      { headers: this.getAuthHeaders() });
  }

  //Delete Ai setting
  deleteAiSetting(id: any): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ai_settings/${id}`,
      { headers: this.getAuthHeaders() });
  }
}




