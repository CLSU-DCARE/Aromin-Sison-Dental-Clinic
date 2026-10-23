/** Poll the authenticated server across devices; preserve the last good snapshot on failure. */
window.ClinicLiveSync = class ClinicLiveSync {
  constructor({ fetchSnapshot, applySnapshot, onStatus = () => {}, interval = 10000, validate = null }) {
    this.validate = validate;
    this.fetchSnapshot = fetchSnapshot;
    this.applySnapshot = applySnapshot;
    this.onStatus = onStatus;
    this.interval = interval;
    this.timer = null;
    this.running = false;
    this.pending = null;
    this.failures = 0;
    this.last = null;
    this.lastData = null;
    this.generation = 0;
    this.resume = () => {
      if (document.hidden) { clearTimeout(this.timer); return; }
      this.refresh();
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.resume);
    window.addEventListener('focus', this.resume);
    window.addEventListener('online', this.resume);
    this.refresh();
  }

  stop() {
    this.running = false;
    this.generation++;
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.resume);
    window.removeEventListener('focus', this.resume);
    window.removeEventListener('online', this.resume);
  }

  refresh() {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (!this.running || document.hidden) return Promise.resolve();
    const generation = this.generation;
    this.pending = (async () => {
      try {
        const data = await this.fetchSnapshot();
        if (!this.running || generation !== this.generation) return;
        if (!data || (this.validate && !this.validate(data))) {
          throw new Error('Invalid dashboard response.');
        }
        const version = JSON.stringify(data);
        if (version !== this.last) {
          const keys = new Set([...Object.keys(this.lastData || {}), ...Object.keys(data)]);
          const changedKeys = new Set([...keys].filter(key => !this.lastData || JSON.stringify(data[key]) !== JSON.stringify(this.lastData[key])));
          this.applySnapshot(data, this.last !== null, changedKeys);
          this.last = version;
          this.lastData = data;
        }
        this.failures = 0;
        this.onStatus('live');
      } catch (error) {
        if (!this.running || generation !== this.generation) return;
        if (error.status === 401 || error.status === 403) {
          this.stop();
          this.onStatus('signed-out');
          return;
        }
        this.failures++;
        this.onStatus(this.last === null ? 'unavailable' : 'reconnecting');
      } finally {
        this.pending = null;
        if (this.running && !document.hidden) {
          const delay = Math.min(this.interval * (2 ** Math.min(this.failures, 4)), 30000);
          this.timer = setTimeout(() => this.refresh(), delay);
        }
      }
    })();
    return this.pending;
  }
};
