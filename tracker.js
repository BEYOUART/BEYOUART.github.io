(function () {
  const trackVisit = async () => {
    try {
      await fetch('/api/track', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true
      });
    } catch (error) {
      console.warn('Could not send visit tracking event', error);
    }
  };

  trackVisit();
})();
