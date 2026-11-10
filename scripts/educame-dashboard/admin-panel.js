const $ = id => document.getElementById(id);
const apps = {
  PROFESOR_PARTICULAR: 'Profesor Particular', ESO_ADULTOS: 'ESO Adultos', CAMBRIDGE: 'Inglés',
  DIPLOMATOR: 'Diplomator', OCR_FACTURAS: 'Lector de Facturas', UNIVERSIDAD_ADULTOS: 'Universidad +25', HAZLOTU: 'HazloTú',
};

function localDate(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function setupAdminPanel({ get, post, element, button, confirm, onForm, busy }) {
  let state;
  let selectedId;
  let selectedApp = 'PROFESOR_PARTICULAR';
  let loading;
  const content = $('admin-content');
  const accountPanel = $('admin-account');
  const login = $('admin-login');
  const logout = $('admin-logout');
  const search = $('admin-search');
  const create = $('admin-create').querySelector('form');
  const send = (path, data) => post('admin/' + path, data);
  const displayName = account => account.full_name || account.email;

  function field(title, node) {
    const label = element('label', '', title);
    label.append(node);
    return label;
  }
  function input(name, type, value = '') {
    const node = element('input');
    Object.assign(node, { name, type, value });
    return node;
  }
  function select(name, choices, value) {
    const node = element('select');
    node.name = name;
    for (const [key, label] of choices) node.append(new Option(label, key));
    node.value = value;
    return node;
  }
  function submit(label) {
    const node = element('button', 'button primary', label);
    node.type = 'submit';
    return node;
  }
  function renderApps() {
    $('admin-apps').replaceChildren(...Object.entries(apps).filter(([key]) => Object.hasOwn(state.apps, key)).map(([key, name]) => {
      const current = state.apps[key].paused;
      const row = element('div', 'operation-app');
      const copy = element('div');
      copy.append(element('strong', '', name), element('p', 'muted', current ? 'Pausada' : 'Disponible'));
      row.append(copy, button(current ? 'Reactivar' : 'Pausar', () => confirm({
        title: (current ? 'Reactivar ' : 'Pausar ') + name,
        copy: current ? 'Los usuarios volverán a tener acceso a la aplicación.' :
          'Los usuarios dejarán de poder entrar o guardar hasta que reactives la aplicación. Sus datos se conservan.',
        label: current ? 'Reactivar' : 'Pausar', action: async () => {
          await send('pause', { product: key, paused: !current, expected: current });
          await load();
        },
      })));
      return row;
    }));
  }
  function renderAccounts() {
    const term = search.value.trim().toLocaleLowerCase('es');
    const accounts = state.accounts.filter(item => [item.full_name, item.email, item.organization_name].join(' ').toLocaleLowerCase('es').includes(term));
    const list = $('admin-accounts');
    list.replaceChildren(...accounts.slice(0, 60).map(item => {
      const control = button(displayName(item) + (item.is_active ? '' : ' · Desactivada'), () => {
        selectedId = item.id;
        selectedApp = item.accesses[0]?.product_code || 'PROFESOR_PARTICULAR';
        for (const node of list.querySelectorAll('button')) node.setAttribute('aria-pressed', String(node === control));
        renderAccount();
      });
      control.setAttribute('aria-pressed', String(selectedId === item.id));
      return control;
    }));
    if (!accounts.length) list.append(element('p', 'muted', 'No se han encontrado cuentas.'));
    if (accounts.length > 60) list.append(element('p', 'muted', 'Se muestran 60 de ' + accounts.length + ' cuentas. Acota la búsqueda para ver las demás.'));
  }
  function renderAccount() {
    const account = state.accounts.find(item => item.id === selectedId);
    accountPanel.replaceChildren();
    if (!account) {
      accountPanel.append(element('p', 'muted', 'Selecciona una cuenta para ver sus datos y licencias.'));
      return;
    }
    const { id, full_name, email, is_active } = account;
    accountPanel.append(element('h3', '', displayName(account)), element('p', 'muted', account.organization_name + ' · ' + email));
    if (account.role === 'user') {
      const form = element('form', 'operation-form');
      const mail = input('email', 'email', email);
      mail.required = true;
      const active = select('is_active', [['true', 'Activa'], ['false', 'Desactivada']], String(is_active));
      form.append(field('Nombre', input('full_name', 'text', full_name)), field('Correo', mail),
        field('Estado de la cuenta', active), submit('Guardar cuenta'));
      onForm(form, values => {
        const payload = { id, ...values, is_active: values.is_active === 'true', expected: { full_name, email, is_active } };
        const action = async () => { await send('account', payload); await load(); };
        if (payload.is_active === is_active && payload.email === email) return action();
        confirm({ title: 'Guardar los cambios de la cuenta', copy: displayName(account) +
          (payload.is_active ? ' quedará con acceso activo.' : ' quedará con el acceso desactivado.'), action });
      });
      accountPanel.append(form);
    } else accountPanel.append(element('p', 'muted', 'Cuenta con rol ' + account.role + '. Puedes editarla en Administración online.'));
    const product = select('product', Object.entries(apps).filter(([key]) => key !== 'HAZLOTU')
      .map(([key, name]) => [key, name + (account.accesses.some(access => access.product_code === key) ? ' · Con licencia' : '')]), selectedApp);
    product.addEventListener('change', () => {
      selectedApp = product.value;
      renderLicense(account);
    });
    const heading = element('div', 'operation-license');
    heading.append(element('h4', '', 'Licencias'), field('Aplicación', product), element('div', 'operation-license-fields'));
    accountPanel.append(heading);
    renderLicense(account);
  }
  function renderLicense(account) {
    const access = account.accesses.find(item => item.product_code === selectedApp);
    const form = element('form', 'operation-form');
    const expiry = input('expires_at', 'datetime-local', localDate(access?.expires_at || Date.now() + 365 * 86400000));
    expiry.required = true;
    const limit = input('usage_limit', 'number', String(access?.total_credits ?? 300));
    Object.assign(limit, { min: 0, max: 2147483647, step: 1, required: true });
    form.append(field('Vencimiento (hora local)', expiry), field('Créditos totales · 0 sin límite', limit),
      field('Estado de la licencia', select('status', [['active', 'Activa'], ['suspended', 'Suspendida'], ['expired', 'Caducada']], access?.status || 'active')));
    if (selectedApp === 'PROFESOR_PARTICULAR') form.append(field('Tipo de cuenta', select('plan',
      [['PROFESOR_FREE', 'Normal'], ['PROFESOR_PREMIUM', 'Premium']], access?.plan === 'PROFESOR_PREMIUM' ? 'PROFESOR_PREMIUM' : 'PROFESOR_FREE')));
    if (selectedApp === 'OCR_FACTURAS') form.append(field('Rol de Facturas', select('access_role',
      [['user', 'Usuario'], ['admin', 'Administrador']], access?.access_role || 'user')));
    form.append(submit(access ? 'Guardar licencia' : 'Asignar licencia'));
    const copy = access ? 'Créditos utilizados · ' + access.used_credits +
      (access.scope === 'shared' ? ' · El cambio se aplicará a esta cuenta mediante una licencia personal.' : '') : 'Esta cuenta todavía no tiene acceso asignado.';
    accountPanel.querySelector('.operation-license-fields').replaceChildren(element('p', 'muted', copy), form);
    onForm(form, values => {
      const product = selectedApp;
      const expires = access && values.expires_at === localDate(access.expires_at) ? access.expires_at : new Date(values.expires_at).toISOString();
      const payload = { ...values, product, id: account.id, usage_limit: Number(values.usage_limit),
        expires_at: expires, expected: access || null };
      confirm({ title: access ? 'Guardar licencia' : 'Asignar licencia', copy: apps[product] + ' · ' + displayName(account),
        action: async () => { await send('license', payload); await load(); } });
    });
  }
  function render(result) {
    state = result;
    login.hidden = result.connected;
    content.hidden = logout.hidden = !result.connected;
    if (!result.connected) {
      selectedId = null;
      search.value = '';
      accountPanel.replaceChildren();
      $('admin-accounts').replaceChildren();
      $('admin-apps').replaceChildren();
      create.elements.organization_id.replaceChildren();
      create.reset();
      return;
    }
    create.elements.organization_id.replaceChildren(...state.organizations.map(org => new Option(org.name, org.id)));
    renderApps();
    renderAccounts();
    renderAccount();
  }
  function load() {
    if (!loading) loading = get('admin').then(render).finally(() => { loading = null; });
    return loading;
  }
  onForm(login, async values => { await send('login', values); await load(); });
  onForm(create, async values => {
    const account = await send('create-account', values);
    selectedId = account.id;
    search.value = '';
    create.reset();
    $('admin-create').open = false;
    await load();
  });
  logout.addEventListener('click', () => busy(logout, async () => { await send('logout'); render({ connected: false }); }));
  search.addEventListener('input', renderAccounts);
  return { load };
}
