/* =========================================================================
   Amorino — "bolo desconstruído": as camadas do Bolo de Maracujá começam
   separadas e se juntam conforme a rolagem. Frames WebP gerados a partir de
   img/bolo-maracuja/montagem.mp4 por scripts/gerar-frames.py (o vídeo não é
   carregado pelo site).
   ========================================================================= */
(function () {
  const BOLO = {
    frames: 120,                                    // quantidade de frames em cada pasta
    pasta: 'img/bolo-maracuja/frames',              // telas grandes (720×1280)
    pastaMobile: 'img/bolo-maracuja/frames-mobile', // telas pequenas (720×1280, arquivo mais leve)
    fundo: '#DABFAD',                               // cor real do fundo dos frames
    // trechos do progresso da seção (0 = topo, 1 = fim)
    animacao: [0.0, 0.7],    // 0% bolo explodido → 70% bolo montado (o resto fica parado no montado)
    // >1 adianta o começo (o vídeo original é lento no início) e desacelera no fim
    aceleraInicio: 1.6,
    rotulos: [0.02, 0.3],    // rótulos das camadas somem nesse intervalo
    intro: [0.0, 0.15],      // texto de abertura some
    final: [0.62, 0.8],      // texto do bolo + botão de encomenda aparece
  };

  const section = document.querySelector('.desc');
  const canvas = document.getElementById('bolo-canvas');
  const visual = document.getElementById('desc-visual');
  const poster = document.getElementById('desc-poster');
  const intro = document.getElementById('desc-intro');
  const final = document.getElementById('desc-final');
  const labels = [...document.querySelectorAll('.desc__label')];
  if (!section || !canvas) return;
  const ctx = canvas.getContext('2d');

  const mobile = window.matchMedia('(max-width: 820px)').matches;
  const pasta = mobile ? BOLO.pastaMobile : BOLO.pasta;
  const src = (i) => `${pasta}/frame-${String(i + 1).padStart(3, '0')}.webp`;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const seg = (p, [a, b]) => clamp01((p - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ----------------------------- preload --------------------------------- */
  // Primeiro e último frame, depois um a cada 8, 4, 2 e o resto: dá para rolar
  // cedo (mostrando o frame carregado mais próximo). O poster cobre a espera.
  const images = new Array(BOLO.frames);
  const ready = new Array(BOLO.frames).fill(false);
  const order = [];
  const seen = new Set();
  const push = (i) => { if (i >= 0 && i < BOLO.frames && !seen.has(i)) { seen.add(i); order.push(i); } };
  push(0); push(BOLO.frames - 1);
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < BOLO.frames; i += step) push(i);

  let loading = 0;
  function next() {
    while (loading < 6 && order.length) {
      const i = order.shift();
      const img = new Image();
      img.decoding = 'async';
      loading++;
      img.onload = () => {
        // decodifica antes de usar: evita travadas ao desenhar durante a rolagem
        const done = () => {
          loading--;
          ready[i] = true;
          draw(true);
          if (i === 0) poster.classList.add('is-hidden');
          next();
        };
        (img.decode ? img.decode() : Promise.resolve()).then(done, done);
      };
      img.onerror = () => { loading--; next(); };
      img.src = src(i);
      images[i] = img;
    }
  }

  function nearest(i) {
    if (ready[i]) return i;
    for (let d = 1; d < BOLO.frames; d++) {
      if (ready[i - d]) return i - d;
      if (ready[i + d]) return i + d;
    }
    return -1;
  }

  /* ----------------------------- desenho ---------------------------------- */
  // O canvas tem a mesma proporção do vídeo (9:16): o frame ocupa o canvas todo.
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = visual.clientWidth;
    H = visual.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    draw(true);
    updateUI();
  }

  // Desenha a posição fracionária: o frame atual e, por cima, o próximo com
  // transparência proporcional — o movimento fica contínuo entre os frames.
  let drawnPos = -1;
  function draw(force) {
    const a = nearest(Math.floor(pos));
    if (a < 0) return;
    if (!force && Math.abs(pos - drawnPos) < 0.02) return;
    drawnPos = pos;
    ctx.globalAlpha = 1;
    ctx.fillStyle = BOLO.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(images[a], 0, 0, W, H);
    const b = a + 1;
    const t = pos - a;
    if (a === Math.floor(pos) && t > 0.02 && b < BOLO.frames && ready[b]) {
      ctx.globalAlpha = Math.min(1, t);
      ctx.drawImage(images[b], 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  /* ----------------------------- textos ----------------------------------- */
  function fade(el, k, dy) {
    el.style.opacity = String(k);
    el.style.transform = `translateY(${(1 - k) * dy}px)`;
    el.style.visibility = k <= 0.001 ? 'hidden' : 'visible';
  }

  function updateUI() {
    const p = smoothP;
    const montagem = montagemAt(p);
    // rótulos acompanham a altura da camada (do explodido ao montado) e somem aos poucos
    const kl = 1 - smooth(seg(p, BOLO.rotulos));
    for (const li of labels) {
      const y = (+li.dataset.y0 + (+li.dataset.y1 - +li.dataset.y0) * montagem) * H;
      const side = li.classList.contains('desc__label--left') ? 1 : -1;
      li.style.transform = `translate(${side * (1 - kl) * 24}px, ${y}px) translateY(-50%)`;
      li.style.opacity = String(kl);
      li.style.visibility = kl <= 0.001 ? 'hidden' : 'visible';
    }
    fade(intro, 1 - smooth(seg(p, BOLO.intro)), -40);
    fade(final, smooth(seg(p, BOLO.final)), 30);
  }

  /* ----------------------------- scroll ----------------------------------- */
  function progress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return clamp01(-rect.top / Math.max(total, 1));
  }
  // progresso da montagem (0 explodido … 1 montado), com início acelerado
  const montagemAt = (p) => 1 - Math.pow(1 - seg(p, BOLO.animacao), BOLO.aceleraInicio);
  const frameAt = (p) => montagemAt(p) * (BOLO.frames - 1);

  // Suaviza a rolagem e só redesenha quando a posição muda.
  let target = progress();
  let smoothP = target;
  let pos = frameAt(smoothP);
  let ticking = false;
  function tick() {
    smoothP += (target - smoothP) * 0.4;
    if (Math.abs(target - smoothP) < 0.00005) smoothP = target;
    pos = frameAt(smoothP);
    draw(false);
    updateUI();
    if (smoothP !== target) requestAnimationFrame(tick);
    else ticking = false;
  }
  function onScroll() {
    target = progress();
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();
  next();
})();
