(function () {
  const API_BASE_KEY = 'beyouartApiBaseUrl';
  const getApiBase = () => localStorage.getItem(API_BASE_KEY) || window.location.origin;
  const getApiUrl = (pathname) => `${getApiBase()}${pathname}`;

  const trackVisit = async () => {
    try {
      await fetch(getApiUrl('/api/track'), {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        keepalive: true
      });
    } catch (error) {
      console.warn('Could not send visit tracking event', error);
    }
  };

  trackVisit();
})();
