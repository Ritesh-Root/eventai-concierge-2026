/**
 * @fileoverview Data-integrity tests for the event dataset.
 * Ensures that all IDs are unique, all referenced floors are valid,
 * all times parse correctly, and map coordinates are within bounds.
 * These tests act as a guard against data-entry typos that could
 * break the UI or confuse the AI model's grounding.
 */

'use strict';

const eventData = require('../src/utils/eventData');

describe('Event Data Integrity', () => {
  // ── Basic shape ────────────────────────────────────────────────────

  it('should have a name and date', () => {
    expect(typeof eventData.name).toBe('string');
    expect(eventData.name.length).toBeGreaterThan(0);
    expect(eventData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should have a venue with mapBox dimensions', () => {
    expect(eventData.venue).toBeDefined();
    expect(eventData.venue.mapBox.width).toBeGreaterThan(0);
    expect(eventData.venue.mapBox.height).toBeGreaterThan(0);
  });

  it('should have wifi credentials', () => {
    expect(eventData.wifi).toBeDefined();
    expect(typeof eventData.wifi.network).toBe('string');
    expect(typeof eventData.wifi.password).toBe('string');
  });

  it('should have emergency information', () => {
    expect(eventData.emergency).toBeDefined();
    expect(typeof eventData.emergency.emergencyNumber).toBe('string');
    expect(eventData.emergency.evacuationPoints.length).toBeGreaterThan(0);
  });

  // ── Sessions ───────────────────────────────────────────────────────

  it('should have at least 5 sessions', () => {
    expect(eventData.sessions.length).toBeGreaterThanOrEqual(5);
  });

  it('should have unique session IDs', () => {
    const ids = eventData.sessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have valid time format for all sessions', () => {
    const timeRegex = /^\d{2}:\d{2}[–-]\d{2}:\d{2}$/;
    eventData.sessions.forEach((s) => {
      expect(s.time).toMatch(timeRegex);
    });
  });

  it('should have valid floor numbers for all sessions', () => {
    eventData.sessions.forEach((s) => {
      expect(s.floor).toBeGreaterThanOrEqual(0);
      expect(s.floor).toBeLessThanOrEqual(eventData.venue.floors);
    });
  });

  it('should have map coordinates within the venue bounds', () => {
    const { width, height } = eventData.venue.mapBox;
    eventData.sessions.forEach((s) => {
      if (s.map) {
        expect(s.map.x).toBeGreaterThanOrEqual(0);
        expect(s.map.x).toBeLessThanOrEqual(width);
        expect(s.map.y).toBeGreaterThanOrEqual(0);
        expect(s.map.y).toBeLessThanOrEqual(height);
      }
    });
  });

  it('should have non-empty title and speaker for all sessions', () => {
    eventData.sessions.forEach((s) => {
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.speaker).toBe('string');
      expect(s.speaker.length).toBeGreaterThan(0);
    });
  });

  it('should have accessibility info for all sessions', () => {
    eventData.sessions.forEach((s) => {
      expect(typeof s.accessibility).toBe('string');
      expect(s.accessibility.length).toBeGreaterThan(0);
    });
  });

  // ── Booths ─────────────────────────────────────────────────────────

  it('should have at least 5 booths', () => {
    expect(eventData.booths.length).toBeGreaterThanOrEqual(5);
  });

  it('should have unique booth IDs', () => {
    const ids = eventData.booths.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have map data for all booths', () => {
    eventData.booths.forEach((b) => {
      expect(b.map).toBeDefined();
      expect(typeof b.map.x).toBe('number');
      expect(typeof b.map.y).toBe('number');
      expect(typeof b.map.label).toBe('string');
    });
  });

  // ── Quiet zones ────────────────────────────────────────────────────

  it('should have at least one quiet zone', () => {
    expect(eventData.quietZones.length).toBeGreaterThanOrEqual(1);
  });

  // ── Food and drink ─────────────────────────────────────────────────

  it('should have food and drink options', () => {
    expect(eventData.foodAndDrink.length).toBeGreaterThanOrEqual(1);
    eventData.foodAndDrink.forEach((f) => {
      expect(typeof f.name).toBe('string');
      expect(typeof f.hours).toBe('string');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────

  it('should have comprehensive accessibility information', () => {
    expect(eventData.accessibility).toBeDefined();
    expect(typeof eventData.accessibility.serviceAnimals).toBe('string');
    expect(typeof eventData.accessibility.signLanguage).toBe('string');
    expect(typeof eventData.accessibility.captioning).toBe('string');
  });

  it('should have wheelchair-accessible routes', () => {
    expect(eventData.wheelchairAccessibleRoutes.length).toBeGreaterThanOrEqual(1);
    eventData.wheelchairAccessibleRoutes.forEach((r) => {
      expect(typeof r.name).toBe('string');
      expect(typeof r.description).toBe('string');
    });
  });

  // ── Info kiosks ────────────────────────────────────────────────────

  it('should have at least one info kiosk', () => {
    expect(eventData.infoKiosks.length).toBeGreaterThanOrEqual(1);
  });

  // ── Restrooms ──────────────────────────────────────────────────────

  it('should have restroom info for multiple floors', () => {
    expect(eventData.restrooms.length).toBeGreaterThanOrEqual(2);
  });

  // ── Parking and transit ────────────────────────────────────────────

  it('should have parking and transit options', () => {
    expect(eventData.parkingAndTransit.length).toBeGreaterThanOrEqual(1);
  });

  // ── Sponsors ───────────────────────────────────────────────────────

  it('should have sponsors listed', () => {
    expect(Array.isArray(eventData.sponsors)).toBe(true);
    expect(eventData.sponsors.length).toBeGreaterThan(0);
  });
});
