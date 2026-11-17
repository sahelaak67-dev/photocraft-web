const grid = document.getElementById('appGrid');
const searchInput = document.getElementById('search');
const filterBtns = document.querySelectorAll('.filter-btn');

let apps = [];
let statusMap = {};

function getAppUrl(app) {
  return app.mode === 'external' ? app.url : `./${app.slug}/`;
}

function handleCardClick(e, url, available) {
  if (!available || e.target.closest('.card-link')) return;

  if (url.startsWith('http')) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = url;
  }
}

function render(items) {
  grid.innerHTML = items.map(app => {
    const info = statusMap[app.slug] || { available: true, version: '' };
    const url = getAppUrl(app);
    const versionBadge = info.version
      ? `<span class="version-pill">${info.version}</span>`
      : '';

    return `
      <article
        class="card ${info.available ? '' : 'unavailable'}"
        data-url="${url}"
        data-available="${info.available}"
      >
        <div>
          <div class="card-header">
            <div class="card-header-left">
              <div class="icon-box" style="color: ${app.color}; background: ${app.bg}">
                ${app.name.charAt(0)}
              </div>
              <div class="card-title">
                <h3>${app.name}</h3>
                <span>vs. ${app.target}</span>
              </div>
            </div>
            ${versionBadge}
          </div>
          <p class="desc">${app.desc}</p>
        </div>
        <div class="card-actions">
          <span class="btn-launch ${info.available ? '' : 'disabled'}">
            ${info.available ? '⚡ Launch Web App' : 'Web Build Unavailable'}
          </span>
          <div class="card-links">
            <a href="https://github.com/${app.repo}" class="card-link" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/${app.repo}/releases" class="card-link" target="_blank" rel="noopener noreferrer">Releases</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function filterApps() {
  const term = searchInput.value.toLowerCase();
  const activeCat = document.querySelector('.filter-btn.active').dataset.filter;

  const filtered = apps.filter(app => {
    const matchesSearch =
      app.name.toLowerCase().includes(term) ||
      app.target.toLowerCase().includes(term) ||
      app.desc.toLowerCase().includes(term);
    const matchesCat = activeCat === 'all' || app.cat === activeCat;
    return matchesSearch && matchesCat;
  });

  render(filtered);
}

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  handleCardClick(e, card.dataset.url, card.dataset.available === 'true');
});

searchInput.addEventListener('input', filterApps);
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterApps();
  });
});

async function init() {
  const [appsRes, statusRes] = await Promise.all([
    fetch('./apps.json'),
    fetch('./status.json').catch(() => null),
  ]);

  apps = await appsRes.json();
  if (statusRes && statusRes.ok) {
    statusMap = await statusRes.json();
  }

  render(apps);
}

init();
