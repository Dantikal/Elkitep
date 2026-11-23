export type Route = 'home' | 'login' | 'admin' | 'about';

export const readRoute = (): Route => {
  const h = window.location.hash.replace('#/', '');
  return h === 'login' || h === 'admin' || h === 'about' ? h : 'home';
};

export const navigate = (r: Route) => {
  const next = r === 'home' ? '' : `#/${r}`;
  if (window.location.hash !== next) window.location.hash = next;
  if (r === 'home') history.replaceState(null, '', window.location.pathname);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};
