import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Pengganti `next/headers` untuk tes. Setiap Browser menyimpan cookie jar sendiri; `sebagai()`
 * menjalankan satu "request" dengan AsyncLocalStorage sehingga request paralel dari browser
 * berbeda tidak saling tertukar.
 */
export interface OpsiCookie {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string | boolean;
  path?: string;
  maxAge?: number;
  expires?: Date;
}

export class Browser {
  readonly jar = new Map<string, { value: string; opsi: OpsiCookie }>();
  /** Header tambahan per request, mis. x-forwarded-for palsu. */
  readonly headerTambahan = new Map<string, string>();
  constructor(public ip: string | null = null) {}
}

const konteks = new AsyncLocalStorage<Browser>();

export function sebagai<T>(browser: Browser, fn: () => Promise<T>): Promise<T> {
  return konteks.run(browser, fn);
}

function browserAktif(nama: string): Browser {
  const b = konteks.getStore();
  // Pesan sama dengan Next.js, supaya plugin nextCookies memperlakukannya sama.
  if (!b) throw new Error(`\`${nama}\` was called outside a request scope.`);
  return b;
}

export async function headers(): Promise<Headers> {
  const b = browserAktif("headers");
  const h = new Headers();
  // Konteks Server Action (plugin nextCookies membedakannya dari render RSC).
  h.set("next-action", "tes");
  if (b.ip) h.set("x-vercel-forwarded-for", b.ip);
  for (const [k, v] of b.headerTambahan) h.set(k, v);
  const cookie = [...b.jar].map(([k, { value }]) => `${k}=${value}`).join("; ");
  if (cookie) h.set("cookie", cookie);
  return h;
}

export async function cookies() {
  const b = browserAktif("cookies");
  return {
    get: (name: string) => {
      const c = b.jar.get(name);
      return c ? { name, value: c.value } : undefined;
    },
    getAll: () => [...b.jar].map(([name, { value }]) => ({ name, value })),
    has: (name: string) => b.jar.has(name),
    set: (name: string, value: string, opsi: OpsiCookie = {}) => {
      if (opsi.maxAge === 0 || value === "") b.jar.delete(name);
      else b.jar.set(name, { value, opsi });
    },
    delete: (name: string) => {
      b.jar.delete(name);
    },
  };
}
