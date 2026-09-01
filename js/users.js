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
  loadingCell.colSpan = 5;
  loadingCell.style.cssText = 'text-align:center; color:var(--text-muted); padding:3rem;';
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

    const nonAdminUsers = (users || []).filter(u => {
      const r = (u.role || '').toUpperCase();
      return r !== 'ADMIN';
    });
    
    if (nonAdminUsers.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      emptyCell.style.cssText = 'text-align:center; color:var(--text-muted); padding:3rem;';
      emptyCell.textContent = 'Nenhum usuário pendente ou cadastrado no momento.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    nonAdminUsers.forEach(user => {
      const tr = document.createElement('tr');

      // Name
      const tdName = document.createElement('td');
      tdName.textContent = user.name || user.full_name || '-';
      tr.appendChild(tdName);

      // Email
      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email || '-';
      tr.appendChild(tdEmail);

      // Phone
      const tdPhone = document.createElement('td');
      tdPhone.textContent = user.phone || '-';
      tr.appendChild(tdPhone);

      // Status badge
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      if (user.status === 'APPROVED') {
        badge.className = 'badge badge-approved';
        badge.textContent = 'Aprovado';
      } else if (user.status === 'REJECTED') {
        badge.className = 'badge badge-rejected';
        badge.textContent = 'Rejeitado';
      } else {
        badge.className = 'badge badge-pending';
        badge.textContent = 'Pendente';
      }
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.style.cssText = 'display:flex; gap:0.5rem;';

      if (user.status === 'PENDING') {
        const btnApprove = document.createElement('button');
        btnApprove.className = 'btn btn-sm btn-success';
        btnApprove.textContent = 'Aprovar';
        btnApprove.addEventListener('click', () => updateStatus(user.id, 'APPROVED'));

        const btnReject = document.createElement('button');
        btnReject.className = 'btn btn-sm btn-danger';
        btnReject.textContent = 'Rejeitar';
        btnReject.addEventListener('click', () => updateStatus(user.id, 'REJECTED'));

        tdActions.appendChild(btnApprove);
        tdActions.appendChild(btnReject);
      } else {
        const resolvedSpan = document.createElement('span');
        resolvedSpan.style.cssText = 'color:var(--text-muted); font-size:0.8rem;';
        resolvedSpan.textContent = 'Resolvido';
        tdActions.appendChild(resolvedSpan);
      }

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    showAlert('Erro ao carregar usuários.', 'error');
  }
}


async function updateStatus(userId, newStatus) {
  if (!window.currentUserIsAdmin) {
    showAlert('Apenas administradores podem autorizar cadastros.', 'error');
    return;
  }

  if (!['APPROVED', 'REJECTED'].includes(newStatus)) {
    showAlert('Status de cadastro inválido.', 'error');
    return;
  }

  const action = newStatus === 'APPROVED' ? 'APROVAR' : 'REJEITAR';
  if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;

  try {
    const { error } = await supabaseClient.rpc('set_member_status', {
      target_user_id: userId,
      new_status: newStatus
    });

    if (error) throw error;

    showAlert(`Usuário ${newStatus === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
    
    // Refresh both table and dashboard
    loadUsers();
    loadDashboardStats();

  } catch (error) {
    showAlert('Erro ao atualizar usuário.', 'error');
  }
}

