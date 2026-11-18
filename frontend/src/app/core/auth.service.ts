import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  LoginResponse,
  MeResponse,
  RegisterActorPayload,
  RegisterResponse,
} from './models';

const TOKEN_KEY = 'nodoo:token';
const BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenState = signal<string | null>(
    localStorage.getItem(TOKEN_KEY),
  );

  private readonly meState = signal<MeResponse | null>(null);

  readonly token = this.tokenState.asReadonly();
  readonly me = this.meState.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  get accessToken(): string | null {
    return this.token();
  }

  login(email: string, password: string): Promise<LoginResponse> {
    return firstValueFrom(
      this.http.post<LoginResponse>(`${BASE}/auth/login`, { email, password }),
    ).then((res) => {
      this.tokenState.set(res.accessToken);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      return res;
    });
  }

  register(payload: RegisterActorPayload): Promise<RegisterResponse> {
    return firstValueFrom(
      this.http.post<RegisterResponse>(`${BASE}/auth/register`, payload),
    );
  }

  refreshMe(): Promise<MeResponse> {
    return firstValueFrom(this.http.get<MeResponse>(`${BASE}/auth/me`)).then(
      (me) => {
        this.meState.set(me);
        return me;
      },
    );
  }

  logout(): void {
    this.tokenState.set(null);
    this.meState.set(null);
    localStorage.removeItem(TOKEN_KEY);
    void this.router.navigate(['/login']);
  }

  redirectIfUnauthed(): void {
    if (!this.isAuthenticated()) {
      void this.router.navigate(['/login']);
    }
  }
}
