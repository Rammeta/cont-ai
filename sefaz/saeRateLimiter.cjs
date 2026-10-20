/**
 * Controlador de vazão (Rate Limiter) e fila assíncrona para requisições à SEFAZ-SP.
 * Evita bloqueios dinâmicos de IP respeitando o limite de requisições por minuto.
 */
class SaeRateLimiter {
  /**
   * @param {Object} options
   * @param {number} [options.delayMs=400] Intervalo mínimo entre requisições em milissegundos (~2.5 req/s)
   * @param {number} [options.maxRetries=3] Tentativas máximas em caso de 429 ou erro temporário
   * @param {number} [options.backoffMultiplier=2] Multiplicador de backoff exponencial
   */
  constructor(options = {}) {
    this.delayMs = options.delayMs || 400;
    this.maxRetries = options.maxRetries || 3;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.lastRequestTime = 0;
  }

  /**
   * Aguarda o tempo necessário para respeitar o intervalo mínimo
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      const waitTime = this.delayMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Executa uma função com throttling e retry com backoff exponencial
   * @param {Function} taskFn
   * @param {string} [contextInfo='']
   */
  async execute(taskFn, contextInfo = '') {
    let attempt = 0;
    let currentDelay = this.delayMs;

    while (attempt <= this.maxRetries) {
      await this.throttle();
      try {
        const result = await taskFn();
        return result;
      } catch (err) {
        attempt++;
        const isRateLimited = err.message && (err.message.includes('429') || err.message.includes('Consumo Indevido') || err.message.includes('656'));
        const isNetworkErr = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || (err.message && err.message.includes('timeout'));

        if (attempt > this.maxRetries || (!isRateLimited && !isNetworkErr)) {
          throw err;
        }

        const waitBackoff = currentDelay * Math.pow(this.backoffMultiplier, attempt);
        console.warn(`⏳ [RateLimit/Backoff] Tentativa ${attempt}/${this.maxRetries} (${contextInfo}): aguardando ${waitBackoff}ms devido a: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, waitBackoff));
        currentDelay = waitBackoff;
      }
    }
  }
}

module.exports = SaeRateLimiter;
