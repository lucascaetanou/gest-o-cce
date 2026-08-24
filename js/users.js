// ============================================
// Gestão CCE — Módulo de Gestão de Usuários e Contas
// ============================================

// Carrega tabela de usuários do sistema
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

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

    const nonAdminUsers = users.filter(u => u.role !== 'ADMIN');
    
    if (nonAdminUsers.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      emptyCell.style.cssText = 'text-align:center; color:var(--text-muted); padding:3rem;';
      emptyCell.textContent = 'Nenhum usuário encontrado.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    nonAdminUsers.forEach(user => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = user.name || '-';
      tr.appendChild(tdName);

      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email || '-';
      tr.appendChild(tdEmail);

      const tdPhone = document.createElement('td');
      tdPhone.textContent = user.phone || '-';
      tr.appendChild(tdPhone);

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
        resolvedSpan.style.cssText = 'font-size:0.8rem; color:var(--text-muted);';
        resolvedSpan.textContent = 'Resolvido';
        tdActions.appendChild(resolvedSpan);
      }

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    showAlert('Erro ao carregar lista de usuários.', 'error');
  }
}

// Atualiza status de aprovação de um usuário
async function updateStatus(userId, newStatus) {
  if (!supabaseClient) return;

  const actionText = newStatus === 'APPROVED' ? 'aprovar' : 'rejeitar';
  if (!confirm(`Tem certeza que deseja ${actionText} este usuário?`)) return;

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (error) throw error;

    showAlert(`Usuário ${newStatus === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
    loadUsers();

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    showAlert('Erro ao atualizar status do usuário.', 'error');
  }
}
