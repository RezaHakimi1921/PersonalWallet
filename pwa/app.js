const API = '/api';
const content = document.getElementById('content');
const navButtons = document.querySelectorAll('nav button');

function toman(rial) {
  return Math.round(rial / 10).toLocaleString('en-US');
}

async function api(path, opts) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.tab);
  });
});

async function render(tab) {
  content.innerHTML = '<p class="muted">در حال بارگذاری...</p>';
  try {
    if (tab === 'pending') return renderPending();
    if (tab === 'transactions') return renderTransactions();
    if (tab === 'accounts') return renderAccounts();
    if (tab === 'installments') return renderInstallments();
    if (tab === 'investments') return renderInvestments();
    if (tab === 'categories') return renderCategories();
  } catch (e) {
    content.innerHTML = '<p class="muted">خطا در بارگذاری اطلاعات</p>';
  }
}

async function renderPending() {
  const [txs, cats] = await Promise.all([api('/transactions?status=pending'), api('/categories')]);
  if (txs.length === 0) {
    content.innerHTML = '<p class="muted">تراکنش در انتظاری وجود ندارد.</p>';
    return;
  }
  content.innerHTML = txs.map((t) => txCard(t, cats, true)).join('');
  txs.forEach((t) => wireTxCard(t));
}

async function renderTransactions() {
  const txs = await api('/transactions');
  if (txs.length === 0) {
    content.innerHTML = '<p class="muted">هیچ تراکنشی ثبت نشده.</p>';
    return;
  }
  content.innerHTML = txs.map((t) => `
    <div class="card">
      <div class="row">
        <span class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.direction === 'income' ? '+' : '-'}${toman(t.amount_rial)} تومان
        </span>
        <span class="muted">${new Date(t.created_at).toLocaleString('fa-IR')}</span>
      </div>
      <div class="muted">${t.account_name} · ${t.category_name || 'بدون دسته'}${t.note ? ' · ' + t.note : ''}</div>
    </div>
  `).join('');
}

function txCard(t, cats, editable) {
  const options = cats
    .filter((c) => c.direction === t.direction)
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join('');
  return `
    <div class="card" id="tx-${t.id}">
      <div class="row">
        <span class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.direction === 'income' ? '+' : '-'}${toman(t.amount_rial)} تومان
        </span>
        <span class="muted">${t.account_name}</span>
      </div>
      <div class="muted">موجودی بعد از تراکنش: ${t.balance_after_rial != null ? toman(t.balance_after_rial) + ' تومان' : '-'}</div>
      ${editable ? `
        <select id="cat-${t.id}"><option value="">انتخاب دسته‌بندی...</option>${options}</select>
        <input id="note-${t.id}" placeholder="توضیح (اختیاری)" />
        <button class="action" id="confirm-${t.id}">ثبت</button>
      ` : ''}
    </div>
  `;
}

function wireTxCard(t) {
  const btn = document.getElementById(`confirm-${t.id}`);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const category_id = document.getElementById(`cat-${t.id}`).value || null;
    const note = document.getElementById(`note-${t.id}`).value || null;
    await api(`/transactions/${t.id}/confirm`, { method: 'POST', body: JSON.stringify({ category_id, note }) });
    document.getElementById(`tx-${t.id}`).remove();
  });
}

async function renderAccounts() {
  const accounts = await api('/accounts');
  content.innerHTML = accounts.map((a) => `
    <div class="card row">
      <span>${a.display_name}</span>
      <strong>${toman(a.balance_rial)} تومان</strong>
    </div>
  `).join('');
}

async function renderInstallments() {
  const items = await api('/installments');
  content.innerHTML = `
    <div class="card">
      <strong>افزودن قسط/وام جدید</strong>
      <input id="i-title" placeholder="عنوان (مثلا: وام خودرو)" />
      <select id="i-type"><option value="installment">قسط</option><option value="loan">وام</option></select>
      <input id="i-amount" type="number" placeholder="مبلغ هر قسط (تومان)" />
      <input id="i-count" type="number" placeholder="تعداد کل اقساط" />
      <input id="i-day" type="number" placeholder="روز موعد در ماه (شمسی)" min="1" max="31" />
      <button class="action" id="i-add">افزودن</button>
    </div>
  ` + (items.length === 0 ? '<p class="muted">قسطی ثبت نشده.</p>' : items.map((i) => `
    <div class="card">
      <div class="row"><strong>${i.title}</strong><span class="muted">${i.type === 'loan' ? 'وام' : 'قسط'}</span></div>
      <div class="muted">${toman(i.installment_amount_rial)} تومان · پرداخت‌شده ${i.paid_count} از ${i.total_count} · روز موعد: ${i.due_day_of_month}</div>
      ${i.status === 'active' ? `<button class="action secondary" data-pay="${i.id}">ثبت پرداخت دستی</button>` : '<div class="muted">تکمیل‌شده</div>'}
    </div>
  `).join(''));

  document.getElementById('i-add').addEventListener('click', async () => {
    const title = document.getElementById('i-title').value;
    const type = document.getElementById('i-type').value;
    const installment_amount_toman = Number(document.getElementById('i-amount').value);
    const total_count = Number(document.getElementById('i-count').value);
    const due_day_of_month = Number(document.getElementById('i-day').value);
    if (!title || !installment_amount_toman || !total_count || !due_day_of_month) return;
    await api('/installments', {
      method: 'POST',
      body: JSON.stringify({
        title, type,
        installment_amount_rial: installment_amount_toman * 10,
        total_count, due_day_of_month,
      }),
    });
    renderInstallments();
  });

  document.querySelectorAll('[data-pay]').forEach((b) => {
    b.addEventListener('click', async () => {
      await api(`/installments/${b.dataset.pay}/pay`, { method: 'POST' });
      renderInstallments();
    });
  });
}

async function renderInvestments() {
  const items = await api('/investments');
  content.innerHTML = `
    <div class="card">
      <strong>افزودن سرمایه‌گذاری</strong>
      <input id="v-title" placeholder="عنوان (مثلا: طلا)" />
      <input id="v-amount" type="number" placeholder="مبلغ سرمایه‌گذاری‌شده (تومان)" />
      <button class="action" id="v-add">افزودن</button>
    </div>
  ` + (items.length === 0 ? '<p class="muted">سرمایه‌گذاری ثبت نشده.</p>' : items.map((v) => `
    <div class="card">
      <strong>${v.title}</strong>
      <div class="muted">مبلغ اولیه: ${toman(v.invested_amount_rial)} تومان</div>
      <div class="grid2">
        <input id="v-cur-${v.id}" type="number" placeholder="ارزش فعلی (تومان)" value="${toman(v.current_value_rial)}" />
        <button class="action secondary" data-update="${v.id}">به‌روزرسانی</button>
      </div>
    </div>
  `).join(''));

  document.getElementById('v-add').addEventListener('click', async () => {
    const title = document.getElementById('v-title').value;
    const amountToman = Number(document.getElementById('v-amount').value);
    if (!title || !amountToman) return;
    await api('/investments', {
      method: 'POST',
      body: JSON.stringify({ title, invested_amount_rial: amountToman * 10 }),
    });
    renderInvestments();
  });

  document.querySelectorAll('[data-update]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = b.dataset.update;
      const val = Number(document.getElementById(`v-cur-${id}`).value) * 10;
      await api(`/investments/${id}`, { method: 'PUT', body: JSON.stringify({ current_value_rial: val }) });
      renderInvestments();
    });
  });
}

async function renderCategories() {
  const cats = await api('/categories');
  content.innerHTML = `
    <div class="card">
      <strong>افزودن دسته‌بندی جدید</strong>
      <input id="c-name" placeholder="نام دسته‌بندی" />
      <select id="c-dir"><option value="expense">هزینه (کسر از حساب)</option><option value="income">درآمد (واریز)</option></select>
      <button class="action" id="c-add">افزودن</button>
    </div>
  ` + cats.map((c) => `
    <div class="card row">
      <span>${c.name} <span class="muted">(${c.direction === 'income' ? 'درآمد' : 'هزینه'})</span></span>
      <button class="action secondary" style="width:auto" data-edit="${c.id}" data-name="${c.name}">ویرایش نام</button>
    </div>
  `).join('');

  document.getElementById('c-add').addEventListener('click', async () => {
    const name = document.getElementById('c-name').value;
    const direction = document.getElementById('c-dir').value;
    if (!name) return;
    await api('/categories', { method: 'POST', body: JSON.stringify({ name, direction }) });
    renderCategories();
  });

  document.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', async () => {
      const newName = prompt('نام جدید:', b.dataset.name);
      if (!newName) return;
      await api(`/categories/${b.dataset.edit}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      renderCategories();
    });
  });
}

// deep link support: #/tx/123 -> open pending tab
if (location.hash.startsWith('#/tx/')) {
  navButtons.forEach((b) => b.classList.remove('active'));
  document.querySelector('[data-tab="pending"]').classList.add('active');
  render('pending');
} else {
  render('pending');
}
