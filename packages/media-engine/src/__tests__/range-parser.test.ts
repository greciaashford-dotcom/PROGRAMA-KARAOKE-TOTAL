import { describe, it, expect } from 'vitest';
import { parseByteRange } from '../range-parser.js';
import { getMimeType } from '../mime.js';

describe('parseByteRange', () => {
  const TOTAL_SIZE = 1000;

  it('returns full file range when rangeHeader is undefined or empty', () => {
    const res = parseByteRange(undefined, TOTAL_SIZE);
    expect(res).toEqual({
      start: 0,
      end: 999,
      chunkSize: 1000,
      totalSize: 1000,
    });
  });

  it('parses valid start-end range bytes=0-499', () => {
    const res = parseByteRange('bytes=0-499', TOTAL_SIZE);
    expect(res).toEqual({
      start: 0,
      end: 499,
      chunkSize: 500,
      totalSize: 1000,
    });
  });

  it('parses open-ended range bytes=500-', () => {
    const res = parseByteRange('bytes=500-', TOTAL_SIZE);
    expect(res).toEqual({
      start: 500,
      end: 999,
      chunkSize: 500,
      totalSize: 1000,
    });
  });

  it('clamps end position when requested end exceeds totalSize', () => {
    const res = parseByteRange('bytes=500-2000', TOTAL_SIZE);
    expect(res).toEqual({
      start: 500,
      end: 999,
      chunkSize: 500,
      totalSize: 1000,
    });
  });

  it('parses suffix range bytes=-200 (last 200 bytes)', () => {
    const res = parseByteRange('bytes=-200', TOTAL_SIZE);
    expect(res).toEqual({
      start: 800,
      end: 999,
      chunkSize: 200,
      totalSize: 1000,
    });
  });

  it('returns null when start is greater than totalSize', () => {
    const res = parseByteRange('bytes=1500-', TOTAL_SIZE);
    expect(res).toBeNull();
  });

  it('returns null when end is less than start', () => {
    const res = parseByteRange('bytes=500-200', TOTAL_SIZE);
    expect(res).toBeNull();
  });

  it('returns null for zero or negative totalSize', () => {
    expect(parseByteRange('bytes=0-100', 0)).toBeNull();
    expect(parseByteRange('bytes=0-100', -5)).toBeNull();
  });

  it('returns null for invalid syntax', () => {
    expect(parseByteRange('invalid', TOTAL_SIZE)).toBeNull();
    expect(parseByteRange('bytes=abc-def', TOTAL_SIZE)).toBeNull();
    expect(parseByteRange('bytes=-', TOTAL_SIZE)).toBeNull();
  });

  it('handles comma-separated multi-range by taking first valid range', () => {
    const res = parseByteRange('bytes=0-100, 200-300', TOTAL_SIZE);
    expect(res).toEqual({
      start: 0,
      end: 100,
      chunkSize: 101,
      totalSize: 1000,
    });
  });
});

describe('getMimeType', () => {
  it('maps video formats correctly', () => {
    expect(getMimeType('video.mp4')).toBe('video/mp4');
    expect(getMimeType('video.webm')).toBe('video/webm');
    expect(getMimeType('.mp4')).toBe('video/mp4');
  });

  it('maps audio formats correctly', () => {
    expect(getMimeType('track.mp3')).toBe('audio/mpeg');
    expect(getMimeType('track.wav')).toBe('audio/wav');
    expect(getMimeType('track.ogg')).toBe('audio/ogg');
  });

  it('falls back to application/octet-stream for unknown formats', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    expect(getMimeType('')).toBe('application/octet-stream');
  });
});
