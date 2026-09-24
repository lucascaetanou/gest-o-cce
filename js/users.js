// ============================================
// Gestão CCE — Módulo de Gestão de Usuários
// ============================================

async function loadUsers() {
  if (!window.currentUserIsAdmin) return;
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  // Loading state (safe, no user data)
  tbody.innerHTML = '';
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 6;
  loadingCell.className = 'loading-cell';
  loadingCell.textContent = 'Carregando usuários...';
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  try {
    const { data: users, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    tbody.innerHTML = '';

    // Pendentes primeiro, depois os demais (mais recentes antes)
    const order = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
    const nonAdminUsers = (users || []).filter(u => {
      const r = (u.role || '').toUpperCase();
      return r !== 'ADMIN';
    }).sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0));
    setNavCount('navCountUsers', nonAdminUsers.filter(u => u.status === 'PENDING').length);
    
    if (nonAdminUsers.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 6;
      emptyCell.className = 'loading-cell';
      emptyCell.textContent = 'Nenhum usuário pendente ou cadastrado no momento.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    nonAdminUsers.forEach(user => {
      const tr = document.createElement('tr');

      // Name
      const tdName = document.createElement('td');
      tdName.className = 'cell-main';
      tdName.textContent = user.name || user.full_name || '-';
      tr.appendChild(tdName);

      // Email
      const tdEmail = document.createElement('td');
      tdEmail.className = 'muted';
      tdEmail.textContent = user.email || '-';
      tr.appendChild(tdEmail);

      // Phone
      const tdPhone = document.createElement('td');
      tdPhone.textContent = user.phone || '-';
      tr.appendChild(tdPhone);

      // Tipo de perfil
      const tdRole = document.createElement('td');
      const roleKey = (user.role || 'USER').toUpperCase();
      const roleBadge = document.createElement('span');
      roleBadge.className = `tag ${(PROFILE_TYPES[roleKey] || PROFILE_TYPES.USER).tag}`;
      roleBadge.textContent = getProfileTypeLabel(roleKey);
      tdRole.appendChild(roleBadge);
      tr.appendChild(tdRole);

      // Status badge
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      if (user.status === 'APPROVED') {
        badge.className = 'tag ok';
        badge.textContent = 'Aprovado';
      } else if (user.status === 'REJECTED') {
        badge.className = 'tag danger';
        badge.textContent = 'Recusado';
      } else {
        badge.className = 'tag warn';
        badge.textContent = 'Pendente';
      }
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'r';
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';
      tdActions.appendChild(actionsWrap);

      if (user.status === 'PENDING' || user.status === 'APPROVED') {
        const roleSelect = buildProfileTypeSelect(roleKey, user.status === 'PENDING');
        actionsWrap.appendChild(roleSelect);

        if (user.status === 'PENDING') {
          const btnReject = document.createElement('button');
          btnReject.className = 'btn btn-sm btn-danger';
          btnReject.textContent = 'Recusar';
          btnReject.addEventListener('click', () => updateAccess(user.id, 'REJECTED', null));

          const btnApprove = document.createElement('button');
          btnApprove.className = 'btn btn-sm btn-success';
          btnApprove.textContent = 'Aprovar';
          btnApprove.addEventListener('click', () => updateAccess(user.id, 'APPROVED', roleSelect.value));

          actionsWrap.appendChild(btnReject);
          actionsWrap.appendChild(btnApprove);
        } else {
          const btnSaveRole = document.createElement('button');
          btnSaveRole.className = 'btn btn-sm';
          btnSaveRole.textContent = 'Salvar perfil';
          btnSaveRole.disabled = true;
          roleSelect.addEventListener('change', () => {
            btnSaveRole.disabled = !roleSelect.value || roleSelect.value === roleKey;
          });
          btnSaveRole.addEventListener('click', () => updateAccess(user.id, null, roleSelect.value));
          actionsWrap.appendChild(btnSaveRole);
        }
      } else {
        const resolvedSpan = document.createElement('span');
        resolvedSpan.className = 'hint';
        resolvedSpan.textContent = 'Resolvido';
        actionsWrap.appendChild(resolvedSpan);
      }

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    showAlert('Erro ao carregar usuários.', 'error');
  }
}


function buildProfileTypeSelect(currentRole, withPlaceholder) {
  const select = document.createElement('select');
  select.className = 'form-input';
  select.setAttribute('aria-label', 'Tipo de perfil');
  select.style.width = 'auto';

  if (withPlaceholder || !ASSIGNABLE_PROFILE_TYPES.includes(currentRole)) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Tipo de perfil…';
    select.appendChild(placeholder);
  }

  ASSIGNABLE_PROFILE_TYPES.forEach(role => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = getProfileTypeLabel(role);
    select.appendChild(option);
  });

  select.value = ASSIGNABLE_PROFILE_TYPES.includes(currentRole) ? currentRole : '';
  return select;
}

async function updateAccess(userId, newStatus, newRole) {
  if (!window.currentUserIsAdmin) {
    showAlert('Apenas o admin master pode gerenciar contas de acesso.', 'error');
    return;
  }

  if (newStatus && !['APPROVED', 'REJECTED'].includes(newStatus)) {
    showAlert('Status de cadastro inválido.', 'error');
    return;
  }

  if (newRole && !ASSIGNABLE_PROFILE_TYPES.includes(newRole)) {
    showAlert('Tipo de perfil inválido.', 'error');
    return;
  }

  if (newStatus === 'APPROVED' && !newRole) {
    showAlert('Selecione o tipo de perfil antes de aprovar o cadastro.', 'error');
    return;
  }

  if (!newStatus && !newRole) return;

  let question;
  if (newStatus === 'APPROVED') {
    question = `Aprovar este usuário com o perfil "${getProfileTypeLabel(newRole)}"?`;
  } else if (newStatus === 'REJECTED') {
    question = 'Tem certeza que deseja RECUSAR este usuário?';
  } else {
    question = `Alterar o perfil deste usuário para "${getProfileTypeLabel(newRole)}"?`;
  }
  if (!confirm(question)) return;

  try {
    const { error } = await supabaseClient.rpc('set_member_access', {
      target_user_id: userId,
      new_status: newStatus,
      new_role: newRole
    });

    if (error) throw error;

    let message = 'Perfil do usuário atualizado com sucesso!';
    if (newStatus === 'APPROVED') message = 'Usuário aprovado com sucesso!';
    else if (newStatus === 'REJECTED') message = 'Usuário recusado com sucesso!';
    showAlert(message, 'success');

    // Refresh both table and dashboard
    loadUsers();
    loadDashboardStats();

  } catch (error) {
    console.error(error);
    showAlert('Erro ao atualizar usuário.', 'error');
  }
}
