/** Poll the authenticated server across devices; preserve the last good snapshot on failure. */
window.PatientLiveSync = class PatientLiveSync {
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
        if (this.validate ? !this.validate(data) : (!data || !data.profile || !data.braces?.braces || !data.braces?.contract ||
            typeof data.braces.has_contract !== 'boolean' || !Array.isArray(data.braces.contract.summary) ||
            !Array.isArray(data.braces.contract.payments) || !Array.isArray(data.braces.braces.stages) ||
            !Array.isArray(data.submissions) ||
            !Array.isArray(data.treatments) || !Array.isArray(data.appointments?.schedule) ||
            !Array.isArray(data.appointments?.upcoming) || !Array.isArray(data.appointments?.history))) {
          throw new Error('Invalid dashboard response.');
        }
        const version = JSON.stringify(data);
        if (version !== this.last) {
          this.applySnapshot(data, this.last !== null);
          this.last = version;
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
