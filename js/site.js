// Configuração da confeitaria (WhatsApp: DDI + DDD + número, só dígitos).
const AMORINO = {
  whatsapp: '5511998951888',
  instagram: 'https://www.instagram.com/amorinoconfeitaria_/',
};

function whatsappUrl(message) {
  return `https://wa.me/${AMORINO.whatsapp}?text=${encodeURIComponent(message)}`;
}

// Links de WhatsApp espalhados pela página
document.querySelectorAll('.js-whatsapp').forEach((a) => {
  a.href = whatsappUrl(a.dataset.msg || 'Oi, Amorino! Vim pelo site e queria fazer uma encomenda 🤍');
  a.target = '_blank';
  a.rel = 'noopener';
});

document.getElementById('year').textContent = new Date().getFullYear();

// Copiar chave PIX
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Chave copiada!';
    } catch {
      btn.textContent = btn.dataset.copy;
    }
    setTimeout(() => { btn.textContent = original; }, 2200);
  });
});

// Montador de pedido
(function orderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  const recheio = form.querySelector('#recheio');
  const massa = form.querySelector('#massa');
  const geleiaWrap = form.querySelector('#geleia-wrap');
  const geleia = form.querySelector('#geleia');
  const total = form.querySelector('#total');
  const data = form.querySelector('#data');

  const today = new Date();
  today.setDate(today.getDate() + 5); // bolos festivos: 5 dias de antecedência
  const pad = (n) => String(n).padStart(2, '0');
  data.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function state() {
    const size = form.querySelector('input[name="size"]:checked');
    const opt = recheio.selectedOptions[0];
    const isRV = opt.dataset.rv === '1';
    const kg = parseFloat(size.value);
    const perKg = parseFloat(opt.dataset.price) + (isRV && geleia.checked ? 15 : 0);
    return { size, opt, isRV, kg, perKg, value: kg * perKg };
  }

  function update() {
    const s = state();
    geleiaWrap.hidden = !s.isRV;
    massa.disabled = s.isRV;
    total.textContent = brl(s.value);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = state();
    const nome = form.nome.value.trim();
    const lines = [
      `Oi, Amorino! ${nome ? `Aqui é ${nome}. ` : ''}Quero encomendar um bolo 🤍`,
      '',
      `• Tamanho: ${s.size.dataset.label}`,
      `• Massa: ${s.isRV ? 'Red Velvet' : massa.value}`,
      `• Recheio: ${s.opt.textContent.replace('Red Velvet · ', '')}${s.isRV && geleia.checked ? ' + geleia' : ''}`,
    ];
    if (data.value) {
      const [y, m, d] = data.value.split('-');
      lines.push(`• Data: ${d}/${m}/${y}`);
    }
    if (form.tema.value.trim()) lines.push(`• Tema/decoração: ${form.tema.value.trim()}`);
    lines.push('', `Estimativa do site: ${brl(s.value)} (sem decoração)`);
    window.open(whatsappUrl(lines.join('\n')), '_blank', 'noopener');
  });
})();
