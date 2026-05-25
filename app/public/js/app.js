const API = '';

/* ========== UTILS ========== */
const $ = id => document.getElementById(id);

function showMsg(id, msg, isError = false) {
  const el = $(id);
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#22c55e';
  setTimeout(() => { el.textContent = ''; }, 4000);
}

/* ========== AUTH MODULE ========== */
const auth = {
  token: localStorage.getItem('token') || '',
  user: localStorage.getItem('user') || '',

  init() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    if (this.token) dashboard.show();
  },

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    $('login-form').classList.toggle('hidden', tabName !== 'login');
    $('register-form').classList.toggle('hidden', tabName !== 'register');
  },

  async register() {
    const body = {
      username: $('reg-user').value,
      password: $('reg-pass').value,
      email: $('reg-email').value
    };
    const r = await fetch(API + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    showMsg('auth-msg', data.error || 'Cadastrado! Faça login.', !!data.error);
  },

  async login() {
    const body = {
      username: $('login-user').value,
      password: $('login-pass').value
    };
    const r = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (data.error) return showMsg('auth-msg', data.error, true);

    this.token = data.token;
    this.user = body.username;
    localStorage.setItem('token', this.token);
    localStorage.setItem('user', this.user);
    dashboard.show();
  },

  logout() {
    this.token = '';
    this.user = '';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
  },

  headers() {
    return { 'Authorization': 'Bearer ' + this.token };
  }
};

/* ========== INVENTORY MODULE ========== */
const inventory = {
  async loadProducts() {
    const r = await fetch(API + '/api/products', { headers: auth.headers() });
    if (!r.ok) return showMsg('auth-msg', 'Sessão expirada. Faça login novamente.', true);
    const data = await r.json();
    const tbody = $('products-table');
    tbody.innerHTML = data.map(p => `
      <tr style="${p.current_stock <= p.min_stock ? 'color: #ef4444' : ''}">
        <td>${p.id}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category || '-'}</td>
        <td>${p.unit || '-'}</td>
        <td>${p.current_stock}</td>
        <td>${p.min_stock}</td>
        <td class="actions">
          <button class="btn secondary" onclick="inventory.showHistory(${p.id})">⏳</button>
          <button class="btn secondary" onclick="inventory.editProduct(${p.id})">✏️</button>
          <button class="btn danger" onclick="inventory.removeProduct(${p.id})">🗑️</button>
        </td>
      </tr>
    `).join('');

    const select = $('mov-product');
    select.innerHTML = '<option value="">Selecione...</option>' + data.map(p => `
      <option value="${p.id}">${p.name} (Estoque: ${p.current_stock})</option>
    `).join('');
  },

  async addProduct() {
    const body = {
      name: $('prod-name').value,
      category: $('prod-cat').value,
      unit: $('prod-unit').value,
      current_stock: parseInt($('prod-stock').value) || 0,
      min_stock: parseInt($('prod-min').value) || 0
    };
    if (!body.name) return alert('Nome é obrigatório');
    await fetch(API + '/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers() },
      body: JSON.stringify(body)
    });
    this.refresh();
  },

  async editProduct(id) {
    const r = await fetch(API + '/api/products/' + id, { headers: auth.headers() });
    const p = await r.json();
    const name = prompt('Nome:', p.name);
    if (name === null) return;
    const category = prompt('Categoria:', p.category);
    const unit = prompt('Unidade:', p.unit);
    const min_stock = prompt('Estoque Mínimo:', p.min_stock);

    await fetch(API + '/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth.headers() },
      body: JSON.stringify({ name, category, unit, min_stock: parseInt(min_stock) })
    });
    this.refresh();
  },

  async removeProduct(id) {
    if (!confirm('Excluir produto?')) return;
    const r = await fetch(API + '/api/products/' + id, {
      method: 'DELETE',
      headers: auth.headers()
    });
    if (!r.ok) {
      const data = await r.json();
      alert(data.error || 'Erro ao excluir');
    }
    this.refresh();
  },

  async registerPurchase() {
    const product_id = $('mov-product').value;
    const quantity = parseInt($('mov-qty').value);
    if (!product_id || !quantity) return alert('Selecione o produto e quantidade');

    await fetch(API + '/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers() },
      body: JSON.stringify({ product_id, quantity })
    });
    this.refresh();
  },

  async registerSale() {
    const product_id = $('mov-product').value;
    const quantity = parseInt($('mov-qty').value);
    if (!product_id || !quantity) return alert('Selecione o produto e quantidade');

    const r = await fetch(API + '/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers() },
      body: JSON.stringify({ product_id, quantity })
    });
    if (!r.ok) {
      const data = await r.json();
      alert(data.error + ' (Disponível: ' + data.available + ')');
    }
    this.refresh();
  },

  async showHistory(id) {
    const r = await fetch(API + `/api/products/${id}/history`, { headers: auth.headers() });
    const data = await r.json();
    const container = $('inventory-history');
    if (data.length === 0) {
      container.innerHTML = 'Nenhuma movimentação encontrada.';
      return;
    }
    container.innerHTML = data.map(h => `
      <div class="log-entry">
        <span class="${h.type === 'purchase' ? 'log-info' : 'log-warn'}">
          ${h.type === 'purchase' ? '➕ COMPRA' : '➖ VENDA'}
        </span>
        | Qtd: ${h.quantity} | Data: ${new Date(h.date).toLocaleString('pt-BR')}
      </div>
    `).join('');
  },

  refresh() {
    this.loadProducts();
  }
};

/* ========== DASHBOARD ========== */
const dashboard = {
  show() {
    $('auth-section').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    $('user-display').classList.remove('hidden');
    $('logout-btn').classList.remove('hidden');
    $('username').textContent = auth.user;
    inventory.refresh();
  }
};

/* ========== HEALTH CHECK ========== */
async function checkHealth() {
  try {
    const r = await fetch(API + '/health');
    const data = await r.json();
    const dot = $('status-dot');
    const txt = $('status-text');
    if (data.status === 'ok') {
      dot.className = 'dot';
      txt.textContent = 'Online';
    }
  } catch {
    $('status-dot').className = 'dot error';
    $('status-text').textContent = 'Offline';
  }
}

/* ========== INIT ========== */
checkHealth();
auth.init();