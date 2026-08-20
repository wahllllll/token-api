const state = { sites: [], types: [], query: '', filter: 'all', sort: 'heat' };
const iconExternal = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>';
const recommendationClass = { '强烈推荐': 'recommend-hot', '推荐': 'recommend-good', '暂不推荐': 'recommend-no', '情况不明': 'recommend-unknown' };
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }
function safeHref(value) { try { const url = new URL(String(value)); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } }
function getDataPaths() { const body = document.body; return { data: body.dataset.data || './data/sites.json', types: './data/types.json', config: body.dataset.config || './config/public.config.json' }; }
async function loadJson(path) { const response = await fetch(path, { cache: 'no-store' }); if (!response.ok) throw new Error(`${path} ${response.status}`); return response.json(); }
function hasType(site, type) {
  if (site.types?.some(item => item.slug === type.slug || item.id === type.id)) return true;
  if (type.slug === 'sign-in') return site.signIn;
  if (type.slug === 'recharge') return site.recharge;
  if (type.slug === 'high-quota') return Number(site.freeQuotaValue) >= 20;
  if (type.slug === 'stable') return Number(site.stability) >= 85;
  if (type.slug === 'image') return (site.tags || []).some(tag => String(tag).includes('生图'));
  if (type.slug === 'vpn') return site.requiresVpn;
  if (type.slug === 'pure-public') return site.purePublic;
  return false;
}
function bindControls() {
  document.querySelector('[data-community]')?.addEventListener('click', () => document.querySelector('[data-contact-dialog]')?.showModal());
  document.querySelector('[data-contact-close]')?.addEventListener('click', () => document.querySelector('[data-contact-dialog]')?.close());
  document.querySelector('[data-search]')?.addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); render(); });
  document.querySelector('[data-sort]')?.addEventListener('change', event => { state.sort = event.target.value; render(); });
}
function renderFilters() {
  const container = document.querySelector('[data-filters]'); if (!container) return;
  const types = [...state.types].filter(type => type.showFilter !== false).sort((a,b) => Number(b.sortOrder||0)-Number(a.sortOrder||0));
  const pure = types.filter(type => type.slug === 'pure-public');
  const rest = types.filter(type => type.slug !== 'pure-public');
  const button = type => `<button type="button" data-filter="${escapeHtml(type.slug)}" aria-pressed="${state.filter === type.slug}" style="--filter-color:${escapeHtml(type.color)}">${escapeHtml(type.name)}</button>`;
  container.innerHTML = pure.map(button).join('') + `<button type="button" data-filter="all" aria-pressed="${state.filter === 'all'}">全部</button>` + rest.map(button).join('');
  container.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; render(); }));
}
function getFilteredSites() {
  const type = state.types.find(item => item.slug === state.filter);
  return state.sites.filter(site => !type || hasType(site, type)).filter(site => { if (!state.query) return true; return [site.name,site.category,site.freeQuota,site.status,site.description,site.availableModels?.join(' '),...(site.tags||[])].join(' ').toLowerCase().includes(state.query); }).sort((a,b) => state.sort === 'quota' ? b.freeQuotaValue-a.freeQuotaValue : state.sort === 'updated' ? new Date(b.updatedAt)-new Date(a.updatedAt) : state.sort === 'stability' ? b.stability-a.stability : Number(b.sortOrder||0)-Number(a.sortOrder||0) || b.heat-a.heat);
}
function renderMetrics(sites) {
  const fixed = [['收录站点', sites.length, 'all'], ['可薅额度', `${sites.reduce((sum,s)=>sum+Number(s.freeQuotaValue||0),0)}+`, 'all'], ['稳定均值', `${sites.length ? Math.round(sites.reduce((sum,s)=>sum+Number(s.stability||0),0)/sites.length) : 0}%`, 'all']];
  const dynamic = state.types.filter(type => type.showMetric !== false && type.showMetric).map(type => [type.name, sites.filter(site => hasType(site,type)).length, type.slug]);
  const container = document.querySelector('[data-metrics]'); if (!container) return;
  container.innerHTML = [...fixed, ...dynamic].map(([label,value,filter]) => `<button type="button" class="metric ${state.filter===filter?'is-active':''}" data-metric-filter="${escapeHtml(filter)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></button>`).join('');
  container.querySelectorAll('[data-metric-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.metricFilter; render(); document.querySelector('#sites')?.scrollIntoView({ behavior:'smooth', block:'start' }); }));
}
function renderTicker(sites) { const ticker=document.querySelector('[data-ticker]'); if (!ticker) return; ticker.innerHTML=sites.slice(0,6).map(site=>`<a href="#site-${escapeHtml(site.id||site.slug)}" title="${escapeHtml(site.description||site.freeQuota||'')}"><span>${escapeHtml(site.name)} · ${escapeHtml(site.status)} · ${escapeHtml(site.freeQuota)}</span></a>`).join(''); }
function renderCards(sites) {
  const grid=document.querySelector('[data-grid]'), empty=document.querySelector('[data-empty]'); if(!grid||!empty)return; empty.hidden=sites.length>0;
  grid.innerHTML=sites.map(site=>`<article class="api-card" id="site-${escapeHtml(site.id||site.slug)}"><div class="card-topline"><span class="category" title="${escapeHtml(site.category)}">${escapeHtml(site.category)}</span><span class="status" title="${escapeHtml(site.status)}" data-status="${escapeHtml(site.status)}">${escapeHtml(site.status)}</span>${site.requiresVpn?'<span class="vpn-note" title="需要科学上网">需科学上网</span>':''}${site.purePublic?'<span class="public-note" title="纯公益，无充值入口">纯公益</span>':''}</div><div class="card-title-row"><h2>${escapeHtml(site.name)}</h2><span class="recommendation ${recommendationClass[site.authorRecommendation]||'recommend-unknown'}">${escapeHtml(site.authorRecommendation||'情况不明')}</span></div><p title="${escapeHtml(site.description)}">${escapeHtml(site.description)}</p><div class="quota-row"><strong>${escapeHtml(site.freeQuota)}</strong></div>${site.inviteCode?`<p class="invite-code">邀请码 <strong>${escapeHtml(site.inviteCode)}</strong></p>`:''}<dl class="facts"><div class="fact-heat"><dt>热度</dt><dd title="热度 ${site.heat}"><span class="spark">✦</span>${site.heat}</dd></div><div class="fact-stability"><dt>稳定度</dt><dd title="稳定度 ${site.stability}%">${site.stability}%</dd></div><div class="fact-signin"><dt>签到</dt><dd title="${site.signIn?'支持签到':'暂未发现签到'}">${site.signIn?'支持':'未发现'}</dd></div><div><dt>充值</dt><dd title="${escapeHtml(site.recharge?site.chargeEntry:'无充值入口')}">${site.recharge?escapeHtml(site.chargeEntry):'无'}</dd></div></dl>${site.availableModels?.length?`<div class="model-tags" title="${escapeHtml(site.availableModels.join(', '))}">${site.availableModels.map(model=>`<span>[${escapeHtml(model)}]</span>`).join('')}</div>`:'<div class="model-tags is-empty" title="暂未维护可用模型"><span>[待补充]</span></div>'}<div class="meter"><span style="width:${Math.max(8,site.heat)}%"></span></div><div class="tags">${(site.tags||[]).map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="card-actions"><a class="open-link" href="${safeHref(site.url)}" target="_blank" rel="noopener noreferrer">打开站点 ${iconExternal}</a><span class="updated">更新 ${escapeHtml(site.updatedAt||'待复核')}</span></div></article>`).join('');
}
function render() { renderFilters(); const filtered=getFilteredSites(); renderMetrics(state.sites); renderTicker(state.sites); renderCards(filtered); const count=document.querySelector('[data-count]'); if(count)count.textContent=`${filtered.length} 个结果`; }
async function init() { bindControls(); const paths=getDataPaths(); try { const config=await loadJson(paths.config).catch(()=>({})); const qr=document.querySelector('.qr-placeholder'); if(qr&&config.community?.qrImage)qr.innerHTML=`<img src="${safeHref(new URL(config.community.qrImage,location.href).href)}" alt="公众号二维码">`; const api=config.futureApi; if(api?.enabled&&api.baseUrl){ const response=await loadJson(`${api.baseUrl.replace(/\/$/,'')}${api.sitesEndpoint||'/sites'}`); state.sites=Array.isArray(response)?response:response.data||[]; state.types=response.types||[]; } else { state.sites=await loadJson(paths.data); state.types=await loadJson(paths.types).catch(()=>[]); } if(!Array.isArray(state.sites))throw new Error('站点数据格式无效'); render(); } catch(error) { const grid=document.querySelector('[data-grid]'); if(grid)grid.innerHTML=`<p class="load-error">数据加载失败：${escapeHtml(error.message)}。请通过本地服务器打开页面。</p>`; } }
init();
