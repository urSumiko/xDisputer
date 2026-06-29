import { revalidatePath } from 'next/cache';

export const accountProfileRevalidationPaths = [
  '/',
  '/workspace',
  '/admin',
  '/admin/access',
  '/manager-workspace',
  '/master',
  '/master/ui-workspace'
] as const;

export function revalidateAccountProfileRoutes(nextPath: string) {
  revalidatePath('/', 'layout');
  for (const path of accountProfileRevalidationPaths.slice(1)) {
    revalidatePath(path);
  }
  revalidatePath(nextPath);
}
