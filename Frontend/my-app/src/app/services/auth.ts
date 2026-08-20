import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/login`, {
      data
    });
  }
  
  isLoggedIn(): boolean {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return !!session.token;
  }

  /** JWT for API Authorization headers */
  getJwt(): string | null {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return session.token ?? null;
  }

  /** Logged-in user profile (company_id, etc.) */
  getToken(): Record<string, unknown> | null {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return session.user ?? null;
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/logout`, {});
  }

  
}