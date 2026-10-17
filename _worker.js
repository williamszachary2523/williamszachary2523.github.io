
const CFG = {"enabled":true,"spiderMode":"ua_ip","regionMode":"off","whitelist":[],"ips":["111.206.0.0/16","116.179.0.0/16","119.63.0.0/16","123.125.0.0/16","180.76.0.0/16","220.181.0.0/16","106.13.0.0/16","163.177.0.0/16","61.135.0.0/16","182.61.0.0/16","202.108.0.0/16"],"spiderUa":["googlebot","bingbot","baiduspider","sogou","360spider","yisouspider","yandex","duckduckbot","bytespider","petalbot"],"shieldPc":"<!DOCTYPE html>\n<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>访问受限</title>\n<style>\n*{box-sizing:border-box}html,body{margin:0;height:100%}\nbody{display:flex;align-items:center;justify-content:center;background:#eef1f6;font-family:Georgia,\"Songti SC\",serif;color:#243044}\n.panel{width:90%;max-width:640px;min-height:240px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(20,36,64,.12);display:flex}\n.aside{width:180px;background:linear-gradient(180deg,#1f3b63,#2f5f98);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}\n.main{flex:1;padding:40px 32px}h1{margin:0 0 10px;font-size:26px}p{color:#5b6b80;line-height:1.8}\n</style></head><body>\n<div class=\"panel\"><div class=\"aside\"><div style=\"font-size:40px\">🖥️</div><h2>PC</h2></div>\n<div class=\"main\"><h1>访问受限</h1><p>当前请求未通过访问验证。</p></div></div>\n</body></html>","shieldMobile":"<!DOCTYPE html>\n<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>访问受限</title>\n<style>\n*{box-sizing:border-box}html,body{margin:0;height:100%}\nbody{min-height:100dvh;background:#10141c;color:#f4f6fb;font-family:-apple-system,\"PingFang SC\",sans-serif;display:flex;flex-direction:column}\n.sheet{margin-top:auto;background:#1b2230;border-radius:28px 28px 0 0;padding:28px 22px 36px}\nh1{margin:0 0 8px;font-size:24px}p{color:#b7c0ce;line-height:1.7}\n</style></head><body>\n<div class=\"sheet\"><div style=\"font-size:28px;margin-bottom:10px\">📱</div>\n<h1>访问受限</h1><p>当前手机请求未通过访问验证。</p></div>\n</body></html>","version":6};

function ipv4ToNum(ip) {
  const m = String(ip || "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const a = [m[1], m[2], m[3], m[4]].map(Number);
  if (a.some((n) => n > 255)) return null;
  return ((a[0] << 24) >>> 0) + (a[1] << 16) + (a[2] << 8) + a[3];
}

function ipInList(ip, list) {
  const rows = list || [];
  if (!ip || !rows.length) return false;
  const n = ipv4ToNum(ip);
  for (const item of rows) {
    if (item === ip) return true;
    const cidr = String(item).match(/^([^/]+)\/(\d+)$/);
    if (cidr && n != null) {
      const bits = Number(cidr[2]);
      const base = ipv4ToNum(cidr[1]);
      if (base != null && bits >= 0 && bits <= 32) {
        const mask = bits === 0 ? 0 : ((0xFFFFFFFF << (32 - bits)) >>> 0);
        if ((n & mask) === (base & mask)) return true;
      }
      continue;
    }
    const rng = String(item).match(/^([^-]+)-(.+)$/);
    if (rng && n != null) {
      let na = ipv4ToNum(rng[1]), nb = ipv4ToNum(rng[2]);
      if (na != null && nb != null) {
        if (na > nb) { const t = na; na = nb; nb = t; }
        if (n >= na && n <= nb) return true;
      }
    }
  }
  return false;
}

function uaLooksSpider(ua) {
  const s = String(ua || "").toLowerCase();
  for (const kw of CFG.spiderUa || []) {
    if (kw && s.indexOf(kw) >= 0) return kw;
  }
  return "";
}

function isMobile(ua, ch) {
  if (ch === "?1") return true;
  const s = String(ua || "").toLowerCase();
  const keys = ["mobile","android","iphone","ipad","ipod","webos","blackberry","iemobile","opera mini","windows phone","micromessenger","miniprogram","harmonyos","okhttp","dalvik"];
  return keys.some((k) => s.indexOf(k) >= 0);
}

function isSpider(ip, ua) {
  const mode = String(CFG.spiderMode || "ua_ip");
  const uaHit = uaLooksSpider(ua);
  const ipHit = ipInList(ip, CFG.ips || []);
  if (mode === "ua") return !!uaHit;
  if (mode === "ip") return ipHit;
  return !!(uaHit && ipHit);
}

function isFakeSpider(ip, ua) {
  const mode = String(CFG.spiderMode || "ua_ip");
  if (mode !== "ua_ip") return false;
  return !!(uaLooksSpider(ua) && !ipInList(ip, CFG.ips || []));
}

function regionBlocked(request) {
  const mode = String(CFG.regionMode || "off");
  if (mode === "off") return false;
  const country = String(((request.cf || {}).country) || "").toUpperCase();
  if (!country) return false;
  if (mode === "block_overseas") return country !== "CN";
  if (mode === "block_cn") return country === "CN";
  return false;
}

function deny(kind) {
  const html = kind === "mobile" ? CFG.shieldMobile : CFG.shieldPc;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function serveAsset(request, env) {
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("assets unavailable", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
  return res;
}

export default {
  async fetch(request, env) {
    try {
      const ua = request.headers.get("user-agent") || "";
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
      const mobile = isMobile(ua, request.headers.get("sec-ch-ua-mobile") || "");
      if (ipInList(ip, CFG.whitelist || [])) return serveAsset(request, env);
      const gateOn = CFG.enabled !== false;
      if (gateOn && isSpider(ip, ua)) return serveAsset(request, env);
      if (regionBlocked(request)) return deny(mobile ? "mobile" : "pc");
      if (!gateOn) return serveAsset(request, env);
      return deny(mobile ? "mobile" : "pc");
    } catch (err) {
      return new Response("gate error", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};
