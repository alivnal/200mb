export class CompressionCancelledError extends Error {
  constructor() {
    super('Compression cancelled.');
    this.name = 'CompressionCancelledError';
  }
}
