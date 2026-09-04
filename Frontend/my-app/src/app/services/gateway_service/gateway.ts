import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth';

@Injectable({
  providedIn: 'root'
})
export class GatewayService {
    private apiUrl = environment.gatewayApiUrl;

    constructor(private http: HttpClient, private authService: AuthService) {}
    getAuthHeaders(): HttpHeaders {
      const session = JSON.parse(localStorage.getItem('session') || '{}');
    
      return new HttpHeaders({
        Authorization: `Bearer ${session.token}`
      });
    };

    getGatewaysInfo(): Observable<any> {
      console.log('getGatewaysInfo', this.apiUrl);
        return this.http.get(`${this.apiUrl}/gateway_list`,
           { headers: this.getAuthHeaders() });
    }

    //Monitor Gateways
    monitorGateways(): Observable<any> {
      return this.http.get(`${this.apiUrl}/monitor_gateways`,
         { headers: this.getAuthHeaders() });
    }

    //Gateway Status List
    getGatewayStatusList(): Observable<any> {
      return this.http.get(`${this.apiUrl}/gateway_status_list`,
         { headers: this.getAuthHeaders() });
    }

    addGateway(data: any): Observable<any> {
      return this.http.post(`${this.apiUrl}/add_gateway`, data,
        { headers: this.getAuthHeaders() });
    }
    //Get Single Gateway
    getSingleGateway(id: any): Observable<any> {
      return this.http.get(`${this.apiUrl}/gateway_edit/${id}`,
        { headers: this.getAuthHeaders() });
    }
    //Update Gateway
    updateGateway(data: any): Observable<any> {
      return this.http.put(`${this.apiUrl}/update_gateway`, data,
        { headers: this.getAuthHeaders() });
    }
}
