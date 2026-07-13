export const getPersistentId = () => {
  // localStorage: identidade sobrevive a nova aba / fechamento do browser
  // (migra ids antigos que estavam em sessionStorage)
  let id = localStorage.getItem('avalon_player_id') ?? sessionStorage.getItem('avalon_player_id');
  if (!id) {
    id = crypto.randomUUID();
  }
  localStorage.setItem('avalon_player_id', id);
  return id;
};

// Token é por sala no servidor — chavear por código evita que entrar numa
// segunda sala invalide a reconexão na primeira
export const getSessionToken = (roomCode: string) =>
  localStorage.getItem(`avalon_session_token_${roomCode}`) ??
  localStorage.getItem('avalon_session_token'); // legado: token único global
export const setSessionToken = (roomCode: string, token: string | undefined) => {
  if (token) localStorage.setItem(`avalon_session_token_${roomCode}`, token);
};
