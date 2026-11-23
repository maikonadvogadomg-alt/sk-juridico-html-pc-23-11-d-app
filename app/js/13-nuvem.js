/* =========================================================================
   SK Jurídico HTML — 13-nuvem.js · ☁️ NUVEM (Supabase) — 17/11
   - O MESMO LOGIN e o MESMO Supabase do 💬 Meu Chat (entrou num, entrou no outro).
   - Tudo continua no aparelho (funciona sem internet); a nuvem COPIA e leva para
     o celular, o PC, outro aparelho.
   - Vai: documentos, modelos, ementas, histórico, conversas, regras, códigos e os seus dados (perfil).
   - NÃO vai: as chaves de IA, de pesquisa e do Drive (ficam só no aparelho).
   - Mesma tabela do Meu Chat (mc_itens), com o tipo "jur:…": um SQL só.
   ========================================================================= */
(function (J) {
  'use strict';
  const E = J.esc;
  // a sessão é guardada no formato do Meu Chat: os dois apps enxergam o mesmo login
  const MCK = (k) => 'meuchat:nuvem:' + k;
  const lerMC = (k, d) => { try { const v = localStorage.getItem(MCK(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const gravarMC = (k, v) => { try { localStorage.setItem(MCK(k), JSON.stringify(v)); } catch (e) {} };
  const TABELA = 'mc_itens';
  const LOJAS = ['documentos', 'modelos', 'ementas', 'historico', 'conversas', 'regras', 'codigos'];
  const PREFS = ['perfil', 'esforco', 'tamanho', 'doisPassos', 'lembrarHist', 'internet', 'internetConversa', 'lerRespostas', 'timbrados', 'timbradoAtivo', 'djen:clientes', 'djen:vistos', 'djen:lidas']; // 23/11: + modelos do Word e o 🤖 robô (clientes, vistos, lidas)
  const SQL = `-- ☁️ Meu Chat + SK Jurídico — rode UMA vez no Supabase: SQL Editor → New query → cole → Run
create table if not exists public.mc_itens (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null,
  id text not null,
  dados jsonb,
  apagado boolean not null default false,
  atualizado bigint not null,
  primary key (user_id, tipo, id)
);
create index if not exists mc_itens_atualizado on public.mc_itens (user_id, atualizado);
alter table public.mc_itens enable row level security;
drop policy if exists "cada um ve o seu" on public.mc_itens;
create policy "cada um ve o seu" on public.mc_itens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

  // 17/11: Supabase EMBUTIDO (js/nuvem-embutida.js) — se tiver, é ele que vale e ninguém precisa colar nada
  const EMB = window.NUVEM_EMBUTIDA || {};
  const temEmb = () => !!(EMB.url && EMB.anon);
  if (temEmb()) { gravarMC('url', String(EMB.url).replace(/\/+$/, '')); gravarMC('anon', EMB.anon); } // o Meu Chat (aqui dentro) enxerga também
  const secreta = (k) => !!(window.Segredos && Segredos.ehSecreta(k));
  const cfg = () => (temEmb() ? { url: String(EMB.url).replace(/\/+$/, ''), anon: EMB.anon } : { url: String(lerMC('url', '')).replace(/\/+$/, ''), anon: secreta(lerMC('anon', '')) ? '' : lerMC('anon', '') });
  const sessao = () => lerMC('sessao', null);
  // 🐘 ou ☁️: qual nuvem (a mesma escolha do Meu Chat)
  const tipoNuvem = () => lerMC('tipo', 'supabase');
  const neonConn = () => lerMC('neon', '');
  const ehNeon = () => tipoNuvem() === 'neon';
  const logado = () => (ehNeon() ? !!(neonConn() && lerMC('neonOk', false)) : !!(sessao() && cfg().url && cfg().anon));
  const ligada = () => logado() && J.pref.get('nuvem:ligada', true);

  function traduzir(m) {
    m = String(m);
    if (/invalid login/i.test(m)) return 'E-mail ou senha errados.';
    if (/email not confirmed/i.test(m)) return 'Esse e-mail ainda não foi confirmado. 1º confira se ele está escrito CERTO (letra por letra). Se estiver certo: abra o e-mail do Supabase e toque no link — ou, no site do Supabase, 👤 Users → toque no usuário → Confirm. Depois toque em Entrar.';
    if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta: toque em Entrar.';
    if (/password/i.test(m) && /6|short|weak/i.test(m)) return 'A senha precisa de pelo menos 6 letras/números.';
    if (/invalid api key|no api key/i.test(m)) return 'A chave pública (anon) está errada.';
    return m;
  }
  async function auth(caminho, corpo) {
    const c = cfg(); if (!c.url || !c.anon) throw new Error('Cole o endereço (URL) e a chave pública (anon) do Supabase primeiro.');
    let r; try { r = await fetch(c.url + '/auth/v1/' + caminho, { method: 'POST', headers: { apikey: c.anon, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); }
    catch (e) { throw new Error('Sem conexão com o Supabase (internet ou endereço errado).'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(traduzir(j.error_description || j.msg || j.message || j.error || ('erro ' + r.status)));
    return j;
  }
  function guardarSessao(j) {
    if (!j.access_token) return null;
    const s = { access: j.access_token, refresh: j.refresh_token, expira: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || '', uid: (j.user && j.user.id) || '' };
    gravarMC('sessao', s); return s;
  }
  async function token() {
    let s = sessao(); if (!s) throw new Error('Entre na sua conta da nuvem primeiro.');
    if (Date.now() > s.expira - 60000) {
      try { s = guardarSessao(await auth('token?grant_type=refresh_token', { refresh_token: s.refresh })) || s; }
      catch (e) { if (/conex/i.test(e.message)) throw e; gravarMC('sessao', null); throw new Error('A sessão da nuvem venceu: entre de novo (⚙️ Config → ☁️ Nuvem).'); }
    }
    return s;
  }
  async function rest(metodo, caminho, corpo, prefer) {
    const c = cfg(), s = await token();
    const h = { apikey: c.anon, Authorization: 'Bearer ' + s.access, 'content-type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    let r; try { r = await fetch(c.url + '/rest/v1/' + caminho, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch (e) { throw new Error('Sem conexão com o Supabase.'); }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 || /does not exist|Could not find the table/i.test(j.message || '')) throw new Error('A tabela ainda não existe: toque em 🛠 Conferir a tabela (no ☁️ Nuvem) que eu abro o lugar certo no Supabase.');
      throw new Error(traduzir(j.message || j.hint || ('erro ' + r.status)));
    }
    return r.status === 204 ? null : r.json().catch(() => null);
  }

  // 17/11: entrar pela tela de login (ou pela ⚙️ Config)
  async function entrar(email, senha, criar) {
    email = String(email || '').trim();
    if (!email || !senha) throw new Error('Escreva o e-mail e a senha.');
    const j = criar ? await auth('signup', { email, password: senha }) : await auth('token?grant_type=password', { email, password: senha });
    if (!guardarSessao(j)) return { confirmar: true };
    gravarMC('tipo', 'supabase'); J.pref.set('nuvem:ultimo', 0); J.pref.set('nuvem:ultTipo', ''); J.pref.set('nuvem:ultId', '');
    return { ok: true };
  }
  async function esqueci(email) {
    email = String(email || '').trim(); if (!email) throw new Error('Escreva o seu e-mail primeiro.');
    await auth('recover', { email });
  }
  // ── marcas do que mudou aqui ──
  const mod = () => J.pref.get('nuvem:mod', {});
  const sujos = new Set(); let timer = null, aplicando = false;
  // 17/11: cada mudança ganha uma hora ÚNICA (antes várias ficavam com a mesma e algumas não desciam)
  let ultHora = 0; const horaUnica = () => { let t = Date.now(); if (t <= ultHora) t = ultHora + 1; ultHora = t; return t; };
  function marcar(chave) { const m = mod(); m[chave] = horaUnica(); J.pref.set('nuvem:mod', m); sujos.add(chave); if (ligada()) { clearTimeout(timer); timer = setTimeout(() => subir().catch(aviso), 2500); } }
  function ganchos() {
    const g0 = J.db.guardar.bind(J.db), a0 = J.db.apagar.bind(J.db);
    J.db.guardar = async (loja, obj) => { const r = await g0(loja, obj); if (!aplicando && LOJAS.includes(loja) && !(J.online && J.online.ligado())) marcar('jur:' + loja + ':' + r.id); return r; };
    J.db.apagar = async (loja, id) => { const r = await a0(loja, id); if (!aplicando && LOJAS.includes(loja) && !(J.online && J.online.ligado())) marcar('jur:' + loja + ':' + id); return r; };
    J.db._guardar0 = g0;
    const set0 = J.pref.set;
    let t = null;
    J.pref.set = (k, v) => { set0(k, v); if (!aplicando && PREFS.includes(k)) { clearTimeout(t); t = setTimeout(() => marcar('jur:prefs:prefs'), 800); } };
  }
  async function linha(chave, uid) {
    const p = chave.split(':'); const tipo = p[0] + ':' + p[1], id = p.slice(2).join(':');
    const quando = mod()[chave] || Date.now();
    if (p[1] === 'prefs') { const o = {}; PREFS.forEach((k) => { const v = J.pref.get(k, undefined); if (v !== undefined) o[k] = v; }); return { user_id: uid, tipo, id, dados: o, apagado: false, atualizado: quando }; }
    const obj = await (J.dbLocal || J.db).pegar(p[1], id);
    return { user_id: uid, tipo, id, dados: obj, apagado: !obj, atualizado: quando };
  }
  let subindo = false;
  async function subir(tudo) {
    if (!logado() || subindo) return 0;
    subindo = true;
    try {
      const s = ehNeon() ? { uid: '' } : await token();
      let chaves = [...sujos];
      if (tudo) {
        chaves = ['jur:prefs:prefs'];
        for (const l of LOJAS) for (const o of await (J.dbLocal || J.db).todos(l)) chaves.push('jur:' + l + ':' + o.id);
        const m = mod(); chaves.forEach((k) => { if (!m[k]) m[k] = horaUnica(); }); J.pref.set('nuvem:mod', m);
      }
      let n = 0;
      for (let i = 0; i < chaves.length; i += 15) {
        const lote = await Promise.all(chaves.slice(i, i + 15).map((k) => linha(k, s.uid)));
        if (ehNeon()) await NuvemNeon.upsert(neonConn(), lote);
        else await rest('POST', TABELA + '?on_conflict=user_id,tipo,id', lote, 'resolution=merge-duplicates,return=minimal');
        lote.forEach((l) => sujos.delete(l.tipo + ':' + l.id)); n += lote.length;
      }
      status('✅ Nuvem em dia · ' + new Date().toLocaleTimeString('pt-BR'));
      return n;
    } finally { subindo = false; }
  }
  async function descer() {
    if (!logado()) return 0;
    let desde = J.pref.get('nuvem:ultimo', 0), n = 0;
    const primeira = !desde;
    for (let volta = 0; volta < 50; volta++) {
      const l = ehNeon() ? await NuvemNeon.listar(neonConn(), { desde, depoisTipo: J.pref.get('nuvem:ultTipo', ''), depoisId: J.pref.get('nuvem:ultId', ''), prefixo: (J.online && J.online.ligado()) ? 'jur:prefs' : 'jur:', limite: 200 }) : await rest('GET', TABELA + '?select=tipo,id,dados,apagado,atualizado&tipo=' + ((J.online && J.online.ligado()) ? 'eq.jur:prefs' : 'like.jur:*') + '&atualizado=gt.' + desde + '&order=atualizado.asc&limit=200');
      if (!l || !l.length) break;
      aplicando = true;
      try {
        for (const r of l) {
          const chave = r.tipo + ':' + r.id, m = mod(), loja = r.tipo.split(':')[1];
          if (!primeira && (m[chave] || 0) >= r.atualizado) continue;
          if (loja === 'prefs') { for (const [k, v] of Object.entries(r.dados || {})) if (PREFS.includes(k)) J.pref.set(k, v); }
          else if (LOJAS.includes(loja)) {
            if (r.apagado || !r.dados) await J.db.apagar(loja, r.id);
            else { const atual = r.dados.atualizado; await J.db._guardar0(loja, r.dados); if (atual) { try { const o = await J.db.pegar(loja, r.id); o.atualizado = atual; } catch (e) {} } }
          }
          m[chave] = r.atualizado; J.pref.set('nuvem:mod', m); n++;
        }
      } finally { aplicando = false; }
      desde = l[l.length - 1].atualizado; J.pref.set('nuvem:ultimo', desde); J.pref.set('nuvem:ultTipo', l[l.length - 1].tipo); J.pref.set('nuvem:ultId', l[l.length - 1].id);
      if (l.length < 200) break;
    }
    if (n) J.emit('nuvem', n);
    return n;
  }
  async function sincronizar(tudo) {
    if (!logado()) throw new Error('Entre na sua conta da nuvem primeiro.');
    status('⏳ Sincronizando…');
    const d = await descer(), s = await subir(tudo);
    status('✅ Nuvem em dia · ⬇ ' + d + ' · ⬆ ' + s + ' · ' + new Date().toLocaleTimeString('pt-BR'));
    return { desceu: d, subiu: s };
  }

  // ── tela (⚙️ Config → ☁️ Nuvem) ──
  let msg = '';
  function status(t) { msg = t; const el = J.$('#nv-status'); if (el) el.textContent = t; }
  function aviso(e) { status('⚠ ' + ((e && e.message) || e)); }
  // 🛠 20/11: confere se a tabela existe; se não, copia o comando e ABRE o SQL Editor do seu projeto direto
  function linkSql() { const ref = ((cfg().url || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]; return ref ? 'https://supabase.com/dashboard/project/' + ref + '/sql/new?content=' + encodeURIComponent(SQL) : 'https://supabase.com/dashboard/projects'; }
  async function conferirTabela() {
    status('⏳ Conferindo a tabela no Supabase…');
    try { await rest('GET', 'mc_itens?select=id&limit=1'); status('✅ A tabela mc_itens existe e o seu login lê ela. Está tudo certo.'); return true; }
    catch (e) {
      if (!/tabela ainda não existe/i.test(e.message)) { aviso(e); return false; }
      try { await J.copiar(SQL); } catch (x) {}
      status('📋 A tabela ainda não existe. Copiei o comando. Vai abrir o SQL Editor do SEU projeto: se o comando não aparecer escrito lá, segure e cole, e toque em Run (só uma vez).');
      setTimeout(() => window.open(linkSql(), '_blank'), 900); return false;
    }
  }


  // 🔗 20/11: ATALHOS — vai direto ao lugar certo do site do Supabase (o site é em inglês e é difícil de achar)
  // Dica: no Chrome do celular, ⋮ → "Traduzir" deixa o site em português.
  function atalhos() {
    const ref = ((cfg().url || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
    const P = 'https://supabase.com/dashboard/project/' + ref;
    const l = [['🗝 Tokens da conta (o sbp_ — apagar)', 'https://supabase.com/dashboard/account/tokens']].concat(ref ? [
      ['🔑 Chaves do projeto (publishable / legacy)', P + '/settings/api-keys'],
      ['👤 Usuários (quem pode entrar / trocar senha)', P + '/auth/users'],
      ['📋 Tabela mc_itens (ver as linhas)', P + '/editor'],
      ['🧾 SQL Editor (rodar comando)', P + '/sql/new'],
      ['🔗 Endereço do site (link do e-mail de confirmação)', P + '/auth/url-configuration'],
    ] : []);
    return '<details class="pequeno" style="margin:8px 0"><summary><b>🔗 Atalhos do site do Supabase</b> (vai direto ao lugar)</summary><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">' +
      l.map(([n, u]) => '<a class="bt" style="text-align:left;text-decoration:none" target="_blank" rel="noopener" href="' + u + '">' + n + '</a>').join('') +
      '<p class="mudo">O site é em inglês: no Chrome, toque em ⋮ → <b>Traduzir</b>.</p></div></details>';
  }
  function pintar() {
    const el = J.$('#cf-nuvem'); if (!el) return;
    const c = cfg(), s = sessao();
    const escolha = '<div class="linha" style="margin:6px 0"><label class="peq"><input type="radio" name="nv-tipo" value="neon"' + (ehNeon() ? ' checked' : '') + '> 🐘 <b>Neon</b> — só você: cole o endereço e pronto (o app cria a tabela)</label>' +
      '<label class="peq"><input type="radio" name="nv-tipo" value="supabase"' + (ehNeon() ? '' : ' checked') + '> ☁️ <b>Supabase</b> — com login (para vários aparelhos e, no futuro, clientes)</label></div>';
    if (ehNeon()) {
      const ok = logado();
      el.innerHTML = '<h2>🐘 Nuvem pelo Neon — seus processos em qualquer aparelho</h2>' + escolha +
        '<p class="peq mut">É o <b>mesmo Neon</b> do Meu Chat. Documentos, modelos, ementas, histórico, conversas, regras e os seus dados vão junto. As chaves de IA não vão.</p>' +
        (ok ? '<p>✅ Conectado ao Neon.</p><label class="peq"><input type="checkbox" id="nv-ligada"' + (J.pref.get('nuvem:ligada', true) ? ' checked' : '') + '> Sincronizar sozinho</label>' +
          '<label class="peq" style="display:block;margin-top:8px"><input type="checkbox" class="nv-online"' + (J.pref.get('online', true) ? ' checked' : '') + '> ☁️ <b>Modo online (igual à Replit)</b>: tudo fica SÓ na nuvem — o aparelho não enche e não precisa enviar e puxar.</label><div class="linha"><button class="bt" id="nv-liberar">🧹 Liberar espaço do aparelho</button><span class="peq nv-ocupa" style="color:var(--mut)"></span></div>' +
          '<div class="linha"><button class="bt forte" id="nv-sinc">🔄 Sincronizar agora</button><button class="bt" id="nv-tudo">⬆ Mandar tudo deste aparelho</button><button class="bt" id="nv-trazer" title="Começa do zero e traz TUDO que está na nuvem para este aparelho (junta, não apaga)">⬇ Trazer TUDO da nuvem</button><button class="bt" id="nv-neon-sair">🚪 Desconectar</button></div>'
        : '<ol class="peq"><li>Entre no <b>neon.tech</b> (a conta que você já tem) e abra o projeto.</li><li>Toque em <b>Connect</b> (botão no alto do painel).</li><li>Copie o endereço que começa com <b>postgresql://</b> (se tiver o olhinho 👁 "show password", toque antes, para vir com a senha).</li><li>Cole aqui e toque em <b>🔌 Conectar</b>. O app cria a tabela sozinho.</li></ol>' +
          '<input id="nv-neon" type="password" placeholder="postgresql://usuario:senha@ep-xxxx.neon.tech/neondb?sslmode=require" autocomplete="off">' +
          '<p class="peq mut">⚠ Esse endereço tem a senha do banco: fica só neste aparelho (não vai para a nuvem). No outro aparelho, cole o mesmo endereço.</p>' +
          '<div class="linha"><button class="bt forte" id="nv-neon-ligar">🔌 Conectar</button></div>') +
        '<p class="peq"><a class="bt" target="_blank" rel="noopener" href="https://console.neon.tech/app/projects">🔗 Abrir o painel do Neon</a> <span class="mut">(lá: o projeto → SQL Editor)</span></p>' +
        '<p id="nv-status" class="peq">' + E(msg) + '</p>';
      ligarCliques(el);
      return;
    }
    el.innerHTML = '<h2>☁️ Nuvem (Supabase) — seus processos em qualquer aparelho</h2>' + escolha +
      '<p class="peq mut">É o <b>mesmo login do 💬 Meu Chat</b>: entrou num, entrou no outro. Sem nuvem, tudo fica só neste aparelho. Com ela, documentos, modelos, ementas, histórico, conversas, regras e os seus dados vão junto. As <b>chaves de IA não vão</b>.</p>' +
      (s ? '<p>✅ Conectado como <b>' + E(s.email) + '</b></p>' +
        '<label class="peq"><input type="checkbox" id="nv-ligada"' + (J.pref.get('nuvem:ligada', true) ? ' checked' : '') + '> Sincronizar sozinho</label>' +
        '<label class="peq" style="display:block;margin-top:8px"><input type="checkbox" class="nv-online"' + (J.pref.get('online', true) ? ' checked' : '') + '> ☁️ <b>Modo online (igual à Replit)</b>: tudo fica SÓ na nuvem — o aparelho não enche e não precisa enviar e puxar.</label><div class="linha"><button class="bt" id="nv-liberar">🧹 Liberar espaço do aparelho</button><span class="peq nv-ocupa" style="color:var(--mut)"></span></div>' +
          '<div class="linha"><button class="bt forte" id="nv-sinc">🔄 Sincronizar agora</button><button class="bt" id="nv-tudo">⬆ Mandar tudo deste aparelho</button><button class="bt" id="nv-trazer" title="Começa do zero e traz TUDO que está na nuvem para este aparelho (junta, não apaga)">⬇ Trazer TUDO da nuvem</button><button class="bt" id="nv-sair">🚪 Sair</button><button class="bt" id="nv-tabela">🛠 Conferir a tabela</button></div>'
      : (temEmb() ? '<p class="peq">✅ O Supabase <b>já vem configurado dentro do app</b>: é só o seu e-mail e a sua senha.</p>' : '<details' + (c.url ? '' : ' open') + '><summary class="peq"><b>1ª vez: criar o Supabase (grátis)</b></summary><ol class="peq">' +
          '<li><b>supabase.com</b> → Start your project → New project (região <b>São Paulo</b>).</li>' +
          '<li><b>SQL Editor</b> → New query → <b>📋 Copiar o SQL</b> (aqui embaixo) → cole → <b>Run</b>. (Se já fez no Meu Chat, não precisa de novo.)</li>' +
          '<li><b>Project Settings → API</b>: copie a <b>Project URL</b> e a chave <b>anon public</b> para os campos abaixo.</li>' +
          '<li><b>✨ Criar conta</b> (ou <b>🔑 Entrar</b>, se já criou no Meu Chat).</li></ol>' +
          '<button class="bt" id="nv-sql">📋 Copiar o SQL</button></details>' +
        '<input id="nv-url" placeholder="Project URL (https://xxxx.supabase.co)" value="' + E(c.url) + '" autocomplete="off">' +
        '<input id="nv-anon" placeholder="Chave anon public" value="' + E(c.anon) + '" autocomplete="off">') +
        '<input id="nv-email" type="email" placeholder="Seu e-mail" autocomplete="username">' +
        '<input id="nv-senha" type="password" placeholder="Senha (mínimo 6)" autocomplete="current-password">' +
        '<div class="linha"><button class="bt forte" id="nv-entrar">🔑 Entrar</button><button class="bt" id="nv-criar">✨ Criar conta</button></div>') +
      atalhos() + '<p id="nv-status" class="peq">' + E(msg) + '</p>';
    ligarCliques(el);
  }
  function ligarCliques(el) {
    el.onchange = (e) => { if (e.target.name === 'nv-tipo') { gravarMC('tipo', e.target.value); J.pref.set('nuvem:ultimo', 0); J.pref.set('nuvem:ultTipo', ''); J.pref.set('nuvem:ultId', ''); pintar(); } };
    el.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.id === 'nv-neon-ligar') {
          const c = J.$('#nv-neon').value.trim(); status('⏳ Conectando e criando a tabela…');
          await NuvemNeon.preparar(c); gravarMC('neon', c); gravarMC('neonOk', true); J.pref.set('nuvem:ultimo', 0); J.pref.set('nuvem:ultTipo', ''); J.pref.set('nuvem:ultId', '');
          pintar(); await sincronizar(true);
        }
        if (b.id === 'nv-liberar') { await J.online.liberar(); const o = el.querySelector('.nv-ocupa'); if (o) o.textContent = 'Este app ocupa ' + (await J.online.ocupa()) + ' no aparelho'; }
        if (b.id === 'nv-neon-sair') { gravarMC('neonOk', false); gravarMC('neon', ''); pintar(); status('Desconectado do Neon. Tudo continua neste aparelho.'); }
        if (b.id === 'nv-tabela') await conferirTabela();
        if (b.id === 'nv-sql') { await J.copiar(SQL); status('📋 SQL copiado. Cole no Supabase: SQL Editor → New query → Run.'); }
        if (b.id === 'nv-entrar' || b.id === 'nv-criar') {
          if (J.$('#nv-url')) { gravarMC('url', J.$('#nv-url').value.trim()); gravarMC('anon', J.$('#nv-anon').value.trim()); }
          status('⏳ ' + (b.id === 'nv-criar' ? 'Criando a conta…' : 'Entrando…'));
          const r = await entrar(J.$('#nv-email').value, J.$('#nv-senha').value, b.id === 'nv-criar');
          if (r.confirmar) { status('📧 Conta criada. Confirme no e-mail e depois toque em 🔑 Entrar.'); return; }
          pintar(); await sincronizar(true);
        }
        if (b.id === 'nv-sinc') await sincronizar();
        if (b.id === 'nv-trazer') { status('⏳ Trazendo tudo da nuvem…'); J.pref.set('nuvem:ultimo', 0); J.pref.set('nuvem:ultTipo', ''); J.pref.set('nuvem:ultId', ''); const r = await descer(); status('✅ Trouxe ' + r + ' item(ns) da nuvem.' + (r ? '' : ' (A nuvem está vazia para este app, ou é outro banco/conta.)')); }
        if (b.id === 'nv-tudo') { status('⏳ Mandando tudo…'); status('✅ Mandei ' + (await subir(true)) + ' item(ns).'); }
        if (b.id === 'nv-sair') { gravarMC('sessao', null); J.pref.set('nuvem:ultimo', 0); J.pref.set('nuvem:ultTipo', ''); J.pref.set('nuvem:ultId', ''); pintar(); status('Saiu (vale para o Meu Chat também). Tudo continua neste aparelho.'); }
      } catch (err) { aviso(err); }
    };
    const lg = J.$('#nv-ligada', el); if (lg) lg.onchange = () => J.pref.set('nuvem:ligada', lg.checked);
    const on = el.querySelector('.nv-online'); if (on) on.onchange = () => { J.pref.set('online', on.checked); J.aviso(on.checked ? '☁️ Modo online ligado: tudo vem direto da nuvem.' : 'Modo online desligado: as coisas voltam a ficar no aparelho.', 'info', 5000); };
    const oc = el.querySelector('.nv-ocupa'); if (oc && J.online) J.online.ocupa().then((t) => { oc.textContent = 'Este app ocupa ' + t + ' no aparelho'; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ganchos();
    // 19/11: ANTES sincronizava A CADA MINUTO (deixava o Neon ligado o tempo todo e estourou a cota).
    // AGORA: ao abrir e ao voltar para o app (no máximo 1 vez a cada 10 min); mudou algo → sobe só aquilo.
    const auto = () => { if (!ligada()) return; const k = 'jur-nuvem-ult-auto', agora = Date.now(); let u = 0; try { u = +localStorage.getItem(k) || 0; } catch (e) {} if (agora - u < 10 * 60000) return; try { localStorage.setItem(k, String(agora)); } catch (e) {} sincronizar().catch(aviso); };
    setTimeout(auto, 2000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(); });
  });
  J.nuvem = { rest, conferirTabela, config: cfg, salvarConfig: (u, a) => { a = String(a || '').trim(); if (secreta(a)) throw new Error('🛡 Essa é a chave SECRETA (service_role / sb_secret). Cole a "anon public" ou a "publishable".'); gravarMC('url', String(u || '').trim()); gravarMC('anon', a); }, pintar, sincronizar, subir, descer, logado, SQL, entrar, esqueci, temEmb, sessao, ehNeon };
})(window.J);
