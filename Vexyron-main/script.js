const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');

const ICON_SUN = '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>';

function applyTheme(theme) {
  root.classList.toggle('theme-white', theme === 'white');
  toggle.innerHTML = theme === 'white' ? ICON_MOON : ICON_SUN;
  try {
    localStorage.setItem('vx-theme', theme);
  } catch (e) {}
}

toggle.addEventListener('click', () => {
  const current = root.classList.contains('theme-white') ? 'white' : 'black';
  applyTheme(current === 'white' ? 'black' : 'white');
  toggle.classList.remove('spin');
  void toggle.offsetWidth;
  toggle.classList.add('spin');
});

let saved = null;
try {
  saved = localStorage.getItem('vx-theme');
} catch (e) {}
applyTheme(saved === 'white' ? 'white' : 'black');

const revealEls = Array.from(
  document.querySelectorAll('.card:not(.price-card), .update-wrapper')
);
revealEls.forEach((el, i) => {
  el.classList.add('reveal');
  el.style.setProperty('--d', `${(i % 4) * 80}ms`);
});

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach((el) => io.observe(el));

/* ============ 3D particle network with mouse physics ============ */
const canvas = document.getElementById('bg3d');
const ctx = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let dpr = 1;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

const PARTICLES = 320;
const NEIGHBORS = 3;
const NEAR_MAX = 3.4;
const COLLIDE = 0.9;
const MAX_DRIFT = 1.6;
const particles = [];

function randomParticle() {
  const x = (Math.random() * 2 - 1) * 5.2;
  const y = (Math.random() * 2 - 1) * 2.2;
  const z = (Math.random() * 2 - 1) * 5.2;
  return {
    x, y, z,
    ox: x, oy: y, oz: z,
    vx: 0, vy: 0, vz: 0,
    s: 0.5 + Math.random() * 0.9,
    tw: Math.random() * Math.PI * 2
  };
}

function initParticles() {
  particles.length = 0;
  for (let i = 0; i < PARTICLES; i++) {
    particles.push(randomParticle());
  }
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function project(p, rx, ry, w, h) {
  const cr = Math.cos(rx), sr = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  let x1 = p.x * cy + p.z * sy;
  let z1 = -p.x * sy + p.z * cy;
  let y1 = p.y * cr - z1 * sr;
  let z2 = p.y * sr + z1 * cr;
  const dist = 6;
  const zz = z2 + dist;
  if (zz < 0.2) return null;
  const f = h * 1.4;
  return {
    sx: w / 2 + (x1 * f) / zz,
    sy: h / 2 - (y1 * f) / zz,
    d: zz
  };
}

// convert a screen point + depth back to 3D (inverse of project())
function unproject(msx, msy, rx, ry, w, h, zz) {
  const cr = Math.cos(rx), sr = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const f = h * 1.4;
  const x1 = (msx - w / 2) * (zz / f);
  const y1 = -(msy - h / 2) * (zz / f);
  const z2 = zz - 6;
  const y = cr * y1 + sr * z2;
  const z1 = -sr * y1 + cr * z2;
  return {
    x: cy * x1 - sy * z1,
    z: sy * x1 + cy * z1,
    y
  };
}

// the mouse cursor as a 3D ray, so it touches particles at every depth
function mouseRay(rx, ry, w, h) {
  const msx = ((mouse.x + 1) / 2) * w;
  const msy = ((mouse.y + 1) / 2) * h;
  const A = unproject(msx, msy, rx, ry, w, h, 6);
  const B = unproject(msx, msy, rx, ry, w, h, 4);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dz = B.z - A.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return {
    ox: A.x, oy: A.y, oz: A.z,
    dx: dx / len, dy: dy / len, dz: dz / len
  };
}

function physics(ray, time) {
  for (const p of particles) {
    // gentle spring back to rest position
    p.vx += (p.ox - p.x) * 0.012;
    p.vy += (p.oy - p.y) * 0.012;
    p.vz += (p.oz - p.z) * 0.012;

    // slow idle float so the network drifts softly
    const ft = time * 0.0006;
    p.vx += Math.sin(ft + p.tw) * 0.0011;
    p.vy += Math.cos(ft * 1.2 + p.tw * 1.7) * 0.0011;
    p.vz += Math.sin(ft * 0.8 + p.tw * 2.3) * 0.0011;

    // distance from the particle to the full mouse line (both directions)
    let tx = p.x - ray.ox;
    let ty = p.y - ray.oy;
    let tz = p.z - ray.oz;
    const t = tx * ray.dx + ty * ray.dy + tz * ray.dz;
    const cx = ray.ox + ray.dx * t;
    const cy = ray.oy + ray.dy * t;
    const cz = ray.oz + ray.dz * t;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    const d3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d3 < COLLIDE && d3 > 0.0001) {
      const f = (COLLIDE - d3) / COLLIDE;
      const push = f * f * 0.55;
      p.vx += (dx / d3) * push;
      p.vy += (dy / d3) * push;
      p.vz += (dz / d3) * push;
    }

    // damping + integrate
    p.vx *= 0.88;
    p.vy *= 0.88;
    p.vz *= 0.88;
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;

    // keep particles from drifting too far
    const oxd = p.x - p.ox;
    const oyd = p.y - p.oy;
    const ozd = p.z - p.oz;
    const od2 = oxd * oxd + oyd * oyd + ozd * ozd;
    if (od2 > MAX_DRIFT * MAX_DRIFT) {
      const od = Math.sqrt(od2);
      const sc = MAX_DRIFT / od;
      p.x = p.ox + oxd * sc;
      p.y = p.oy + oyd * sc;
      p.z = p.oz + ozd * sc;
    }
  }
}

function drawGrid(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const white = root.classList.contains('theme-white');

  // background: pure black or pure white
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  if (white) {
    bg.addColorStop(0, '#eaeaea');
    bg.addColorStop(0.5, '#e0e0e0');
    bg.addColorStop(1, '#d4d4d4');
  } else {
    bg.addColorStop(0, '#000000');
    bg.addColorStop(0.5, '#0a0a0a');
    bg.addColorStop(1, '#141414');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // camera barely moves, gentle auto-drift
  const rx = -0.3 + mouse.y * 0.15;
  const ry = mouse.x * 0.2 + t * 0.00002;

  const ray = mouseRay(rx, ry, w, h);
  physics(ray, t);

  const pts = [];
  for (const p of particles) {
    const pr = project(p, rx, ry, w, h);
    if (!pr) continue;
    const depthFade = Math.max(0.15, Math.min(0.9, 1.15 - (pr.d - 6) * 0.14));
    pr.alpha = depthFade;
    pr.pt = p;
    pts.push(pr);
  }

  const lineColor = white ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';

  // dynamic connections: each particle links to its nearest neighbors,
  // so the web reconnects every frame as the particles move
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const b = pts[j];
      const dx = a.pt.x - b.pt.x;
      const dy = a.pt.y - b.pt.y;
      const dz = a.pt.z - b.pt.z;
      const d3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d3 < NEAR_MAX) near.push({ j, d3 });
    }
    near.sort((p, q) => p.d3 - q.d3);
    const k = Math.min(NEIGHBORS, near.length);
    for (let n = 0; n < k; n++) {
      const j = near[n].j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b: pts[j], d: near[n].d3 });
    }
  }

  for (const e of edges) {
    const fade = 1 - e.d / NEAR_MAX;
    const a2 = fade * fade * fade * 0.42 * e.a.alpha * e.b.alpha;
    if (a2 < 0.01) continue;
    ctx.globalAlpha = a2;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.a.sx, e.a.sy);
    ctx.lineTo(e.b.sx, e.b.sy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // glowing nodes
  for (const p of pts) {
    const twinkle = 0.7 + 0.3 * Math.sin(t * 0.002 + p.pt.tw);
    const r = p.pt.s * 1.1 * twinkle * (0.5 + p.alpha * 0.5);
    const glow = r * 2;
    const grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glow);
    if (white) {
      grd.addColorStop(0, `rgba(0, 0, 0, ${0.8 * p.alpha * twinkle})`);
      grd.addColorStop(0.35, `rgba(0, 0, 0, ${0.22 * p.alpha})`);
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      grd.addColorStop(0, `rgba(255, 255, 255, ${0.8 * p.alpha * twinkle})`);
      grd.addColorStop(0.35, `rgba(255, 255, 255, ${0.22 * p.alpha})`);
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, glow, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = white
      ? `rgba(0, 0, 0, ${0.9 * p.alpha})`
      : `rgba(255, 255, 255, ${0.9 * p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // stronger fade toward the edges, middle stays as is (no extra brighten)
  const vigR = Math.max(w, h) * 0.68;
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, vigR);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, white ? 'rgba(110, 110, 110, 0.28)' : 'rgba(0, 0, 0, 0.95)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 1;
}

function gridLoop(t) {
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  drawGrid(t);
  requestAnimationFrame(gridLoop);
}

window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
});

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
initParticles();
if (reducedMotion) {
  drawGrid(0);
} else {
  requestAnimationFrame(gridLoop);
}

/* ============ 3D Scroll Camera ============ */
const camera = document.getElementById('camera');
const introWrap = document.querySelector('.intro-wrap');
const sceneHero = document.getElementById('scene-hero');
const scenePricing = document.getElementById('scene-pricing');
const cards = Array.from(document.querySelectorAll('.price-card'));

const TRAVEL = 1400; // camera travels 0 -> 1400 through the logo
const introScroll = () => Math.max(1, introWrap.offsetHeight - window.innerHeight);

function smooth(a, b, t) {
  const c = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return c * c * (3 - 2 * c);
}

function updateCamera() {
  const p = Math.min(Math.max(window.scrollY / introScroll(), 0), 1);
  camera.style.transform = `translateZ(${p * TRAVEL}px)`;

  // hero flies under/through the camera, then fades
  sceneHero.style.transform = `translateZ(0px) translateY(${p * -120}px)`;
  const heroO = 1 - smooth(0.04, 0.16, p);
  sceneHero.style.opacity = String(heroO);
  sceneHero.style.pointerEvents = heroO > 0.05 ? 'auto' : 'none';

  // pricing appears slowly behind the logo, then fades out cleanly at the end
  scenePricing.style.transform = `translateZ(${(p - 1) * TRAVEL}px)`;
  const pricingIn = smooth(0.06, 0.25, p);
  const pricingOut = 1 - smooth(0.65, 0.82, p);
  const pricingO = pricingIn * pricingOut;
  scenePricing.style.opacity = String(pricingO);
  scenePricing.style.pointerEvents = pricingO > 0.05 ? 'auto' : 'none';
}

let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    updateCamera();
    scrollTicking = false;
  });
});
window.addEventListener('resize', updateCamera);
updateCamera();

/* cards sit slightly folded inward and a bit apart - static, camera flies through */
cards.forEach((card, i) => {
  const isLeft = i === 0;
  const side = isLeft ? -1 : 1;
  const inward = isLeft ? 1 : -1;
  card.style.transform = `translateX(${side * 12}%) rotateY(${inward * 22}deg)`;
  card.style.transformOrigin = isLeft ? 'right center' : 'left center';
});

/* Anfragen buttons inside 3D-transformed cards: guarantee clickability */
const pricingBtns = Array.from(document.querySelectorAll('.price-card a.btn'));
document.addEventListener('click', (e) => {
  const hit = pricingBtns.find((btn) => {
    const r = btn.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  });
  if (hit) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = hit.getAttribute('href');
  }
});

/* ============ Nav scroll targets ============ */
const motionPref = window.matchMedia('(prefers-reduced-motion: reduce)');
const sceneOrder = ['scene-hero', 'scene-pricing'];

document.querySelectorAll('.nav-link[data-scroll]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const idx = Number(link.dataset.scroll);
    if (motionPref.matches) {
      const map = { 0: 'scene-hero', 1: 'scene-pricing', 2: 'kontakt', 3: 'ueber' };
      document.getElementById(map[idx]).scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const vh = window.innerHeight;
    let top;
    if (idx === 0) top = 0;
    else if (idx === 1) top = introScroll() * 0.5;
    else if (idx === 3) top = document.getElementById('ueber').offsetTop - 110;
    else top = document.getElementById('kontakt').offsetTop - 60;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
