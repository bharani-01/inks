const { parseDateRange } = require('../../controllers/analytics.controller');

describe('Analytics Engine Unit Test Suite (controllers/analytics.controller.js)', () => {
  describe('parseDateRange() helper', () => {
    it('should parse 7d preset correctly', () => {
      const { start, end } = parseDateRange({ range: '7d' });
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);

      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(7);
    });

    it('should parse 30d preset correctly', () => {
      const { start, end } = parseDateRange({ range: '30d' });
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(30);
    });

    it('should parse 90d preset correctly', () => {
      const { start, end } = parseDateRange({ range: '90d' });
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(90);
    });

    it('should parse 1y preset correctly', () => {
      const { start, end } = parseDateRange({ range: '1y' });
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(365);
    });

    it('should default to 30d when no range or custom date is provided', () => {
      const { start, end } = parseDateRange({});
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(30);
    });

    it('should parse custom start and end ISO date strings correctly', () => {
      const customStart = '2026-01-01T00:00:00.000Z';
      const customEnd = '2026-01-15T23:59:59.000Z';
      const { start, end } = parseDateRange({ start: customStart, end: customEnd });

      expect(start.toISOString()).toBe(customStart);
      expect(end.toISOString()).toBe(customEnd);
    });
  });
});
