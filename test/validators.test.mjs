import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INPUT_LIMITS,
  normalizeBookmarkCardImage,
  normalizeBookmarkCardStyle,
  normalizeBookmarkCardVideo,
  normalizeBookmarkDesc,
  normalizeBookmarkLogo,
  normalizeBookmarkName,
  normalizeBookmarkUrl,
  normalizeCategoryName,
  validateImportSizes,
} from '../functions/lib/validators.js';

test('text validators trim values and enforce required fields', () => {
  assert.deepEqual(normalizeCategoryName(' 工具 '), { ok: true, value: '工具' });
  assert.equal(normalizeCategoryName('').ok, false);
  assert.equal(normalizeBookmarkName({ text: 'bad' }).ok, false);
  assert.deepEqual(normalizeBookmarkUrl(123), { ok: true, value: '123' });
});

test('bookmark validators enforce field length limits', () => {
  assert.equal(normalizeCategoryName('x'.repeat(INPUT_LIMITS.categoryName + 1)).ok, false);
  assert.equal(normalizeBookmarkName('x'.repeat(INPUT_LIMITS.bookmarkName + 1)).ok, false);
  assert.equal(normalizeBookmarkUrl('https://example.com/' + 'x'.repeat(INPUT_LIMITS.bookmarkUrl)).ok, false);
  assert.equal(normalizeBookmarkLogo('https://example.com/' + 'x'.repeat(INPUT_LIMITS.bookmarkLogo)).ok, false);
  assert.equal(normalizeBookmarkCardImage('https://example.com/' + 'x'.repeat(INPUT_LIMITS.bookmarkCardImage)).ok, false);
  assert.equal(normalizeBookmarkCardVideo('https://example.com/' + 'x'.repeat(INPUT_LIMITS.bookmarkCardVideo)).ok, false);
  assert.equal(normalizeBookmarkDesc('x'.repeat(INPUT_LIMITS.bookmarkDesc + 1)).ok, false);
});

test('optional validators can return null for empty values', () => {
  assert.deepEqual(normalizeBookmarkLogo('', { nullIfEmpty: true }), { ok: true, value: null });
  assert.deepEqual(normalizeBookmarkCardImage('', { nullIfEmpty: true }), { ok: true, value: null });
  assert.deepEqual(normalizeBookmarkCardVideo('', { nullIfEmpty: true }), { ok: true, value: null });
  assert.deepEqual(normalizeBookmarkCardStyle('', { nullIfEmpty: true }), { ok: true, value: null });
  assert.deepEqual(normalizeBookmarkDesc('', { nullIfEmpty: true }), { ok: true, value: null });
  assert.deepEqual(normalizeBookmarkDesc(''), { ok: true, value: '' });
});

test('card style validator only accepts empty or style1 through style5', () => {
  assert.deepEqual(normalizeBookmarkCardStyle(''), { ok: true, value: '' });
  assert.deepEqual(normalizeBookmarkCardStyle('style1'), { ok: true, value: 'style1' });
  assert.deepEqual(normalizeBookmarkCardStyle('style5'), { ok: true, value: 'style5' });
  assert.equal(normalizeBookmarkCardStyle('style6').ok, false);
  assert.equal(normalizeBookmarkCardStyle('javascript:alert(1)').ok, false);
});

test('import size validator caps categories and sites', () => {
  assert.equal(validateImportSizes([], []).ok, true);
  assert.equal(validateImportSizes(new Array(INPUT_LIMITS.importCategories + 1), []).ok, false);
  assert.equal(validateImportSizes([], new Array(INPUT_LIMITS.importSites + 1)).ok, false);
});
