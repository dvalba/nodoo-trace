export enum PlatformRole {
  USER = 'user',
  STAFF = 'staff',
}

export enum UserRole {
  OWNER = 'owner',
  MEMBER = 'member',
  VIEWER = 'viewer',
  ADMIN = 'admin',
}

export type MultiTenantRole = PlatformRole | UserRole;


type AssertTrue<T extends true> = T;

export type RolesMustNotOverlap = AssertTrue<
  Extract<`${PlatformRole}`, `${UserRole}`> extends never
    ? true
    : ['ERROR: PlatformRole y UserRole comparten un valor, revisa los enums']
>;
