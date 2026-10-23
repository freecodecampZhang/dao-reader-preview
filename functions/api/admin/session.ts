import { adminRequired, authConfigured, backendReady, clearSessionCookie, constantTimeTextEqual, failure, hasAdminSession, issueSession, json, opaqueIpKey, sameOrigin, type PagesFunction } from '../../_shared';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const configured = backendReady(env) && authConfigured(env);
  return json({ configured, authenticated: configured && await hasAdminSession(request, env) });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!sameOrigin(request)) return failure('请求来源无效。', 403);
  if (!backendReady(env) || !authConfigured(env)) return failure('管理员书库尚未配置完成。', 503);
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return failure('登录请求过大。', 413);
  let input: unknown;
  try { input = await request.json(); } catch { return failure('登录请求格式无效。'); }
  const username = input && typeof input === 'object' && 'username' in input && typeof input.username === 'string' ? input.username : '';
  const password = input && typeof input === 'object' && 'password' in input && typeof input.password === 'string' ? input.password : '';
  if (!username || username.length > 80 || !password || password.length > 256) return failure('管理员账号或密码不正确。', 401);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = await opaqueIpKey(ip, env.ADMIN_SESSION_SECRET);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE attempted_at < ?').bind(now - 86400).run();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS attempts FROM admin_login_attempts WHERE ip_key = ? AND attempted_at > ?').bind(ipKey, now - 900).first<{ attempts: number }>();
  if ((recent?.attempts || 0) >= 8) return failure('登录尝试次数过多，请 15 分钟后再试。', 429, { 'Retry-After': '900' });

  if (!constantTimeTextEqual(username, env.ADMIN_USERNAME || 'admin') || !constantTimeTextEqual(password, env.ADMIN_PASSWORD)) {
    await env.DB.prepare('INSERT INTO admin_login_attempts (ip_key, attempted_at) VALUES (?, ?)').bind(ipKey, now).run();
    return failure('管理员账号或密码不正确。', 401);
  }

  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_key = ?').bind(ipKey).run();
  const headers = new Headers({ 'Set-Cookie': await issueSession(env.ADMIN_SESSION_SECRET) });
  return json({ authenticated: true }, { headers });
};

export const onRequestDelete: PagesFunction = async (context) => {
  if (!sameOrigin(context.request)) return failure('请求来源无效。', 403);
  const denied = await adminRequired(context);
  if (denied) return denied;
  return json({ authenticated: false }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
