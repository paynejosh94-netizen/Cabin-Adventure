const $ = s => document.querySelector(s);
const app = $('#app'), hud = $('#hud');
let D, S;

const pic = (folder, file, label, cls = '') =>
  `<div class="pic ${cls} ${file ? '' : 'ph'}">${file ? `<img src="Images/${file.includes('/') ? file : folder + '/' + file}" alt="" onerror="this.parentNode.classList.add('ph');this.remove()">` : ''}<span>${label}</span></div>`;
const charPic = (c, cls) => pic('characters', c.image, 'playable char ' + (D.characters.indexOf(c) + 1), cls);
const itemPic = (i, cls) => pic('items', i.image, 'item ' + (D.items.indexOf(i) + 1), cls);
const evPic = (e, cls) => pic('events', e.image, 'event background ' + (D.events.indexOf(e) + 1), cls);
const item = id => D.items.find(i => i.id === id);
const take = a => a.splice(Math.floor(Math.random() * a.length), 1)[0];
const fill = str => {
  const e = S && S.ev && S.ev[S.i];
  const f = e && e.friend && D.characters.find(c => c.id === e.friend);
  return String(str).replace(/\{player\}/g, S && S.char ? S.char.name : 'you').replace(/\{friend\}/g, f ? f.name : 'a friend');
};
const paras = a => a.map(x => `<p>${fill(x)}</p>`).join('');

function drawHud() {
  if (!S || !S.char) { hud.style.display = 'none'; return; }
  const max = D.settings.startingEnergy;
  hud.style.display = 'flex';
  hud.innerHTML = charPic(S.char) + `<div><b>${S.char.name}</b><div class="hearts">${'♥'.repeat(Math.max(S.energy, 0))}${'♡'.repeat(max - Math.max(S.energy, 0))}</div></div>` +
    `<div class="bag">${S.bag.map(id => itemPic(item(id))).join('')}</div>`;
}
let token = 0;
function show(html, bind) {
  const my = ++token;
  const swap = () => {
    if (my !== token) return;
    app.innerHTML = html; drawHud(); window.scrollTo(0, 0);
    app.style.opacity = 1; app.style.pointerEvents = '';
    if (bind) bind();
  };
  if (!app.dataset.ready || matchMedia('(prefers-reduced-motion: reduce)').matches) { app.dataset.ready = 1; swap(); return; }
  app.style.opacity = 0; app.style.pointerEvents = 'none';
  const fade = new Promise(r => setTimeout(r, 250));
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  const load = Promise.race([
    Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = s; }))),
    new Promise(r => setTimeout(r, 1500))]);
  Promise.all([fade, load]).then(swap);
}

function title() {
  S = null;
  show(`<h1>${D.settings.gameTitle}</h1>${pic('story', D.settings.titleImage, 'title background', 'wide')}<button id="go">Start Game</button>`, () => {
    $('#go').onclick = select;
  });
}

function select() {
  let chosen = null;
  show(`<h2>Choose your character</h2><div class="grid">${D.characters.map(c =>
    `<div class="card" data-id="${c.id}">${charPic(c)}<b>${c.name}</b><small>${c.tagline || ''}</small></div>`).join('')}</div>
    <button class="alt" id="back">Back</button><button id="ok" disabled>Confirm</button>`, () => {
  document.querySelectorAll('.card').forEach(el => el.onclick = () => {
    document.querySelectorAll('.card').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel'); chosen = el.dataset.id; $('#ok').disabled = false;
  });
  $('#back').onclick = title;
  $('#ok').onclick = () => {
    S = { char: D.characters.find(c => c.id === chosen), energy: D.settings.startingEnergy, bag: [], i: 0 };
    story(D.story.intro, pack, 'intro');
  };
  });
}

function story(text, next, img) {
  show(`${pic('story', D.story.images && D.story.images[img], 'story background ' + img, 'wide')}${paras(text)}<button id="go">Continue</button>`, () => {
    $('#go').onclick = next;
  });
}

function pack() {
  const n = D.settings.itemsToPick; let sel = [];
  show(`<h2>Pack your bag</h2><p>Choose ${n} items.</p><div class="grid">${D.items.map(i =>
    `<div class="card" data-id="${i.id}">${itemPic(i)}<b>${i.name}</b><small>${i.description}</small></div>`).join('')}</div><button id="ok" disabled>Confirm</button>`, () => {
  document.querySelectorAll('.card').forEach(el => el.onclick = () => {
    const id = el.dataset.id;
    if (sel.includes(id)) sel = sel.filter(x => x !== id);
    else if (sel.length < n) sel.push(id);
    document.querySelectorAll('.card').forEach(x => x.classList.toggle('sel', sel.includes(x.dataset.id)));
    $('#ok').disabled = sel.length !== n;
  });
  const clearWarn = () => { const w = $('#warn'); if (w) w.remove(); $('#ok').hidden = false; };
  document.querySelectorAll('.card').forEach(el => el.addEventListener('click', clearWarn));
  $('#ok').onclick = () => {
    const go = () => { S.bag = sel; buildEvents(); story(D.story.afterPacking, () => story(D.story.busBreakdown, nextEvent, 'busBreakdown'), 'afterPacking'); };
    if (sel.includes(D.settings.friendItem)) return go();
    $('#ok').hidden = true;
    const w = document.createElement('div');
    w.id = 'warn'; w.className = 'result warn';
    w.innerHTML = `<p>${D.settings.friendItemHint || 'You have a feeling you are forgetting something important.'}</p><button class="alt" id="revise">Revise items</button><button id="proceed">Proceed anyway</button>`;
    app.appendChild(w);
    $('#revise').onclick = clearWarn;
    $('#proceed').onclick = go;
  };
  });
}

function buildEvents() {
  const by = t => D.events.filter(e => e.type === t);
  const rand = by('random'), boon = by('boon'), bane = by('bane');
  const friends = by('friend').filter(e => e.friend !== S.char.id);
  const ev = [take(rand), take(rand)];
  const w = D.settings.slot3Weights, pools = { random: rand, boon, bane };
  const types = Object.keys(pools).filter(t => pools[t].length && w[t] > 0);
  let r = Math.random() * types.reduce((s, t) => s + w[t], 0), type = types[0];
  for (const t of types) { if ((r -= w[t]) < 0) { type = t; break; } }
  ev.push(take(pools[type]));
  ev.push(take(friends));
  S.ev = ev; S.i = 0;
}

const correct = e => e.type === 'friend' ? [D.settings.friendItem] : e.correctItems;

function nextEvent() {
  const e = S.ev[S.i], special = e.type === 'boon' || e.type === 'bane';
  const label = { random: 'Random Event', friend: 'Friend Event', boon: 'Boon', bane: 'Bane' }[e.type];
  const f = e.type === 'friend' ? D.characters.find(c => c.id === e.friend) : null;
  const top = f ? `<div class="scene">${evPic(e, 'wide')}${charPic(f, 'portrait')}</div>` : evPic(e, 'wide');
  const body = f ? `<div class="dialogue"><div class="name">${f.name}</div><p>${fill(e.description)}</p></div>` : `<p>${fill(e.description)}</p>`;
  show(`<small>Event ${S.i + 1} of ${S.ev.length} - ${label}</small>${top}<h2>${fill(e.title)}</h2>${body}` +
    (special ? `<button id="go">Press on</button>` :
      `<p><b>Use an item?</b></p><div>${S.bag.map(id => `<button data-id="${id}">${item(id).name}</button>`).join('')}<button class="alt" data-id="">Do nothing (-1 energy)</button></div>`), () => {
  if (special) $('#go').onclick = () => { if (e.type === 'bane') S.energy--; result(e.outcomeText, e.type === 'boon'); };
  else document.querySelectorAll('button[data-id]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (id) S.bag = S.bag.filter(x => x !== id);
    if (id && correct(e).includes(id)) return result(e.successText, true);
    S.energy--; result(id ? e.failText : e.doNothingText, false);
  });
  });
}

function result(text, good) {
  show(`<div class="result ${good ? 'good' : 'bad'}"><p>${fill(text)}</p></div><button id="go">Continue</button>`, () => {
    $('#go').onclick = () => { S.i++; (S.energy <= 0 || S.i >= S.ev.length) ? end() : nextEvent(); };
  });
}

function end() {
  const won = S.energy > 0, E = D.endings;
  const extra = won ? (E.win.byEnergy[S.energy] || '') : '';
  const file = won ? (E.win.images || {})[S.energy] : E.lose.image;
  const art = pic('story', file, won ? `win ending ${S.energy} heart${S.energy === 1 ? '' : 's'}` : 'lose ending', 'wide');
  const max = D.settings.startingEnergy;
  const score = `<div class="score">${'♥'.repeat(S.energy)}${'♡'.repeat(max - S.energy)}</div><div class="scoretext">${S.energy} of ${max} hearts remaining</div>`;
  const html = won
    ? `<div class="ending win">${art}<div class="overlay"><h1>${E.win.title}</h1>${score}<p>${fill(E.win.text)}</p>${extra ? `<p class="flavor">${fill(extra)}</p>` : ''}</div></div>`
    : `<div class="ending">${art}<div class="overlay"><h1>${E.lose.title}</h1><p>${fill(E.lose.text)}</p></div></div>`;
  show(`${html}<button id="go">Play again</button>`, () => {
    $('#go').onclick = title;
  });
}

function validate(d) {
  const ids = new Set(d.items.map(i => i.id)), errs = [];
  if (!ids.has(d.settings.friendItem)) errs.push(`settings.friendItem "${d.settings.friendItem}" is not an item id`);
  d.events.forEach(e => (e.correctItems || []).forEach(i => ids.has(i) || errs.push(`${e.id}: unknown item id "${i}"`)));
  d.characters.forEach(c => d.events.some(e => e.type === 'friend' && e.friend === c.id) || errs.push(`no friend event for character "${c.id}"`));
  return errs;
}

fetch('data.json', { cache: 'no-cache' }).then(r => r.text()).then(t => {
  D = JSON.parse(t);
  const errs = validate(D);
  if (errs.length) app.innerHTML = '<h2>data.json problems</h2>' + errs.map(e => `<p>${e}</p>`).join('');
  else title();
}).catch(e => app.innerHTML = `<p>Could not load data.json: ${e.message}</p><p>If testing locally, use a server (python -m http.server) instead of opening the file directly.</p>`);
