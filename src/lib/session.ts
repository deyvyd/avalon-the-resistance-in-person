export const getPersistentId = () => {
  // localStorage: identidade sobrevive a nova aba / fechamento do browser
  // (migra ids antigos que estavam em sessionStorage)
  let id = localStorage.getItem('avalon_player_id') ?? sessionStorage.getItem('avalon_player_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
  }
  localStorage.setItem('avalon_player_id', id);
  return id;
};

export const getSessionToken = () =>
  localStorage.getItem('avalon_session_token') ?? sessionStorage.getItem('avalon_session_token');
export const setSessionToken = (token: string | undefined) => {
  if (token) localStorage.setItem('avalon_session_token', token);
};
