import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const staffGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const check = (me: { user: { platformRoles: string[] } } | null) => {
    const isStaff = me?.user.platformRoles.includes('staff') ?? false;
    return isStaff ? true : router.createUrlTree(['/']);
  };

  if (auth.me()) {
    return check(auth.me());
  }

  return auth.refreshMe().then(check).catch(() => router.createUrlTree(['/']));
};
