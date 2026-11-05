import { Routes } from '@angular/router';

import { Layout } from './layout/layout';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'products', loadComponent: () => import('./pages/products/products').then((m) => m.Products) },
      { path: 'trace', loadComponent: () => import('./pages/trace/trace').then((m) => m.Trace) },
      { path: 'notices', loadComponent: () => import('./pages/notices/notices').then((m) => m.Notices) },
    ],
  },
  { path: '**', redirectTo: '' },
];
