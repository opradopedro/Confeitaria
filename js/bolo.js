/* =========================================================================
   Amorino — bolo montado conforme o scroll, com frames reais (WebP).
   Os frames são gerados a partir dos vídeos em img/bolo/video/ pelo script
   scripts/gerar-frames.py. Para trocar a animação, gere novos frames e
   ajuste FRAMES abaixo (e os data-start/data-end dos cartões no index.html).
   ========================================================================= */
(function () {
  const BOLO = {
    frames: 150,                          // quantidade de frames em cada pasta
    pasta: 'img/bolo/frames',             // frames para telas grandes (1280×720)
    pastaMobile: 'img/bolo/frames-mobile',// frames para telas pequenas (640×500, só a faixa do bolo)
    inicio: 0.05,                         // progresso do scroll em que a animação começa…
    fim: 0.84,                            // …e termina (depois disso fica no bolo pronto)
    fundo: '#EFDCC0',                     // cor do fundo das imagens
    // Celular (tela em pé): largura do bolo na tela e altura do centro do frame
    larguraBoloMobile: 0.6,               // o bolo ocupa ~60% da largura da tela
    centroMobile: 0.36,                   // centro do frame a 36% da altura (acima dos cartões)
  };
  // Fração da largura do frame ocupada pelo bolo (boleira) em cada versão dos frames
  const BOLO_NO_FRAME = { desktop: 0.36, mobile: 0.5 };

  const canvas = document.getElementById('cake-canvas');
  const stage = document.querySelector('.stage');
  const build = document.querySelector('.build');
  const loader = document.getElementById('loader');
  if (!canvas || !build) return;
  const ctx = canvas.getContext('2d');

  const mobile = window.matchMedia('(max-width: 820px)').matches;
  const pasta = mobile ? BOLO.pastaMobile : BOLO.pasta;
  const src = (i) => `${pasta}/frame-${String(i + 1).padStart(3, '0')}.webp`;

  /* ----------------------------- preload --------------------------------- */
  // Ordem de carregamento: primeiro e último, depois um a cada 8, 4, 2 e o resto —
  // assim dá para rolar cedo, mostrando o frame carregado mais próximo.
  const images = new Array(BOLO.frames);
  const ready = new Array(BOLO.frames).fill(false);
  const order = [];
  const seen = new Set();
  const push = (i) => { if (i >= 0 && i < BOLO.frames && !seen.has(i)) { seen.add(i); order.push(i); } };
  push(0); push(BOLO.frames - 1);
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < BOLO.frames; i += step) push(i);

  let loading = 0;
  const MAX_PARALLEL = 6;
  function next() {
    while (loading < MAX_PARALLEL && order.length) {
      const i = order.shift();
      const img = new Image();
      img.decoding = 'async';
      loading++;
      img.onload = () => {
        // decodifica antes de usar: evita travadas ao desenhar durante a rolagem
        const done = () => {
          loading--;
          ready[i] = true;
          if (i === 0) loader.classList.add('is-done');
          draw(true);
          next();
        };
        (img.decode ? img.decode() : Promise.resolve()).then(done, done);
      };
      img.onerror = () => { loading--; next(); };
      img.src = src(i);
      images[i] = img;
    }
  }
  next();

  function nearest(i) {
    if (ready[i]) return i;
    for (let d = 1; d < BOLO.frames; d++) {
      if (ready[i - d]) return i - d;
      if (ready[i + d]) return i + d;
    }
    return -1;
  }

  /* ----------------------------- desenho ---------------------------------- */
  let W = 0, H = 0, dpr = 1;
  function resize() {
    // no celular, até 1,5× de densidade: mais leve para desenhar a cada quadro
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    draw(true);
  }

  function geometry(img) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const portrait = W / H < 0.9;
    const visibleH = window.innerHeight || H;
    if (portrait) {
      // o bolo ocupa BOLO.larguraBoloMobile da tela, acima dos cartões
      const frac = mobile ? BOLO_NO_FRAME.mobile : BOLO_NO_FRAME.desktop;
      const scale = (W * BOLO.larguraBoloMobile) / (iw * frac);
      const dw = iw * scale, dh = ih * scale;
      return [(W - dw) / 2, visibleH * BOLO.centroMobile - dh / 2, dw, dh];
    }
    // paisagem: o frame ocupa ~90% da altura (sobra espaço para os cartões laterais)
    const scale = Math.max((H * 0.9) / ih, (W * 0.9) / iw);
    const dw = iw * scale, dh = ih * scale;
    return [(W - dw) / 2, (H - dh) / 2, dw, dh];
  }

  // Desenha a posição fracionária: o frame atual e, por cima, o próximo com
  // transparência proporcional — o movimento fica contínuo entre os frames.
  let drawnPos = -1;
  function draw(force) {
    const a = nearest(Math.floor(pos));
    if (a < 0) return;
    if (!force && Math.abs(pos - drawnPos) < 0.02) return;
    drawnPos = pos;
    const g = geometry(images[a]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BOLO.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(images[a], g[0], g[1], g[2], g[3]);
    const b = a + 1;
    const t = pos - a;
    if (a === Math.floor(pos) && t > 0.02 && b < BOLO.frames && ready[b]) {
      ctx.globalAlpha = Math.min(1, t);
      ctx.drawImage(images[b], g[0], g[1], g[2], g[3]);
      ctx.globalAlpha = 1;
    }
  }

  /* ----------------------------- scroll ----------------------------------- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  function progress() {
    const rect = build.getBoundingClientRect();
    const total = build.offsetHeight - window.innerHeight;
    return clamp01(-rect.top / Math.max(total, 1));
  }
  // posição fracionária no vídeo (0 … frames-1)
  const frameAt = (p) => clamp01((p - BOLO.inicio) / (BOLO.fim - BOLO.inicio)) * (BOLO.frames - 1);

  // Cartões de cada etapa, trilho lateral e cartão de abertura
  const steps = [...document.querySelectorAll('.step')];
  const hero = document.querySelector('.step--hero');
  const rail = document.querySelector('.rail');
  const railItems = [...document.querySelectorAll('.rail li')];
  function updateUI(p) {
    // o cartão de abertura sobe e some aos poucos conforme a rolagem
    const k = clamp01(p / 0.045);
    hero.style.opacity = String(1 - k);
    hero.style.transform = `translate(-50%, ${-k * 90}px)`;
    hero.style.visibility = k >= 1 ? 'hidden' : 'visible';
    for (const s of steps) {
      if (s === hero) continue;
      s.classList.toggle('is-active', p >= parseFloat(s.dataset.start) && p < parseFloat(s.dataset.end));
    }
    let cur = -1;
    railItems.forEach((li, i) => { if (p >= parseFloat(li.dataset.at)) cur = i; });
    railItems.forEach((li, i) => {
      li.classList.toggle('is-done', i < cur);
      li.classList.toggle('is-current', i === cur);
    });
    rail.classList.toggle('is-hidden', p < 0.04 || p > 0.9);
  }

  // Suaviza a rolagem e só redesenha quando o frame muda.
  let target = progress();
  let smooth = target;
  let pos = frameAt(smooth);
  let ticking = false;
  function tick() {
    smooth += (target - smooth) * 0.25;
    if (Math.abs(target - smooth) < 0.00005) smooth = target;
    pos = frameAt(smooth);
    draw(false);
    if (smooth !== target) requestAnimationFrame(tick);
    else ticking = false;
  }
  function onScroll() {
    target = progress();
    updateUI(target);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();
  updateUI(target);
})();
