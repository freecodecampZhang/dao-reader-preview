export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}

export interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface AppEnv {
  DB?: D1Database;
  BOOKS?: R2Bucket;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_INDEXING_ENABLED?: string;
}

export interface PagesContext<P = Record<string, string>> {
  request: Request;
  env: AppEnv;
  params: P;
  next(): Promise<Response>;
}

export type PagesFunction<P = Record<string, string>> = (context: PagesContext<P>) => Response | Promise<Response>;

export interface LibraryRow {
  slug: string;
  title: string;
  author: string | null;
  dynasty: string;
  text_form: '' | '简体' | '繁体';
  edition_type: '' | '古籍 TXT' | '校勘本' | '原版影印';
  base_edition: string;
  full_text_confirmed: number;
  original_source: string;
  public_license: string;
  category: string;
  category_slug: string;
  description: string;
  r2_key: string;
  status: 'draft' | 'published';
  rights_confirmed: number;
  commercial_rights_confirmed: number;
  publication_approved: number;
  original_filename: string;
  created_at: number;
  updated_at: number;
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function failure(message: string, status = 400, extraHeaders?: HeadersInit) {
  return json({ error: message }, { status, headers: extraHeaders });
}

export function backendReady(env: AppEnv): env is AppEnv & { DB: D1Database; BOOKS: R2Bucket } {
  return Boolean(env.DB && env.BOOKS);
}

export function authConfigured(env: AppEnv): env is AppEnv & { ADMIN_PASSWORD: string; ADMIN_SESSION_SECRET: string } {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 16 && env.ADMIN_SESSION_SECRET && new TextEncoder().encode(env.ADMIN_SESSION_SECRET).byteLength >= 32);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

const cookieName = '__Host-dao_admin';
const sessionLifetimeSeconds = 8 * 60 * 60;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function makeSession(secret: string, expiresAt: number) {
  const payload = `${expiresAt}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function hasAdminSession(request: Request, env: AppEnv) {
  if (!env.ADMIN_SESSION_SECRET || new TextEncoder().encode(env.ADMIN_SESSION_SECRET).byteLength < 32) return false;
  const raw = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return false;
  const [expiryText, signatureText, extra] = raw.split('.');
  if (!expiryText || !signatureText || extra !== undefined) return false;
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || expiry > Math.floor(Date.now() / 1000) + sessionLifetimeSeconds + 60) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env.ADMIN_SESSION_SECRET), base64UrlToBytes(signatureText), new TextEncoder().encode(expiryText));
  } catch { return false; }
}

export async function adminRequired(context: Pick<PagesContext<unknown>, 'request' | 'env'>): Promise<Response | null> {
  if (!backendReady(context.env)) return failure('管理员书库尚未完成 Cloudflare D1 与 R2 配置。', 503);
  if (!authConfigured(context.env)) return failure('管理员登录尚未配置有效密码和会话密钥。', 503);
  if (!(await hasAdminSession(context.request, context.env))) return failure('请先登录管理员账号。', 401);
  return null;
}

export async function issueSession(secret: string) {
  const expiry = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const token = await makeSession(secret, expiry);
  return `${cookieName}=${token}; Path=/; Max-Age=${sessionLifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function constantTimeTextEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

export async function opaqueIpKey(ip: string, secret: string) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(ip));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function toPublicBook(row: LibraryRow) {
  return {
    slug: row.slug,
    title: row.title,
    ...(row.author ? { author: row.author } : {}),
    ...(row.dynasty ? { dynasty: row.dynasty } : {}),
    ...(row.text_form ? { textForm: row.text_form } : {}),
    ...(row.edition_type ? { editionType: row.edition_type } : {}),
    ...(row.base_edition ? { baseEdition: row.base_edition } : {}),
    fullTextConfirmed: row.full_text_confirmed === 1,
    ...(row.original_source ? { originalSource: row.original_source } : {}),
    ...(row.public_license ? { publicLicense: row.public_license } : {}),
    category: row.category,
    categorySlug: row.category_slug,
    description: row.description,
    contentFile: `api/public/books/${row.slug}/content`,
    status: 'approved' as const,
    rightsConfirmed: true as const,
    commercialRightsConfirmed: true as const,
    publicationApproved: true as const,
  };
}

export function safeSlug(value: string) {
  const normalized = value.normalize('NFKD').trim().toLowerCase();
  const latin = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  if (latin) return latin;
  const encoded = [...new TextEncoder().encode(normalized)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return encoded ? `category-${encoded}` : 'uncategorized';
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maxLength) : '';
}

export function validSiteOrigin(env: AppEnv) {
  if (env.PUBLIC_INDEXING_ENABLED !== 'true' || !env.PUBLIC_SITE_URL) return null;
  try {
    const url = new URL(env.PUBLIC_SITE_URL);
    return url.protocol === 'https:' && !url.username && !url.password && (url.pathname === '/' || !url.pathname) && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}
