import {describe, expect, it} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/types.js'
import {exportToCSV, exportToJSON} from '../../../src/lib/review-queue/exporter.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Test post',
      body: 'Test body content for review.',
      platformMeta: {},
    },
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    scheduledTime: '2026-03-02T09:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

describe('exportToJSON', () => {
  it('exports empty array as JSON', () => {
    const result = exportToJSON([])
    expect(result).toBe('[]')
  })

  it('exports items as pretty-printed JSON array', () => {
    const items = [makeItem()]
    const result = exportToJSON(items)
    const parsed = JSON.parse(result) as ReviewItem[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('item-2026-03-01-001')
    expect(parsed[0].platform).toBe('reddit')
    expect(parsed[0].qualityScore).toBe(0.85)
  })

  it('preserves all fields in JSON export', () => {
    const item = makeItem({
      complianceFlags: ['sensitive-topic'],
      scheduledTime: '2026-03-02T09:00:00Z',
    })
    const result = exportToJSON([item])
    const parsed = JSON.parse(result) as ReviewItem[]
    expect(parsed[0].complianceFlags).toEqual(['sensitive-topic'])
    expect(parsed[0].scheduledTime).toBe('2026-03-02T09:00:00Z')
    expect(parsed[0].content.title).toBe('Test post')
    expect(parsed[0].content.body).toBe('Test body content for review.')
    expect(parsed[0].editHistory).toEqual([])
  })

  it('uses 2-space indentation', () => {
    const items = [makeItem()]
    const result = exportToJSON(items)
    // JSON.stringify with null, 2 uses 2-space indentation
    expect(result).toContain('  "id"')
  })

  it('exports multiple items', () => {
    const items = [
      makeItem({id: 'item-001', platform: 'reddit'}),
      makeItem({id: 'item-002', platform: 'tiktok'}),
      makeItem({id: 'item-003', platform: 'facebook'}),
    ]
    const result = exportToJSON(items)
    const parsed = JSON.parse(result) as ReviewItem[]
    expect(parsed).toHaveLength(3)
    expect(parsed.map((i) => i.id)).toEqual(['item-001', 'item-002', 'item-003'])
  })
})

describe('exportToCSV', () => {
  it('exports empty array with headers only', () => {
    const result = exportToCSV([])
    expect(result).toBe('id,platform,status,qualityScore,contentPreview,contentType,scheduledTime,generatedBy')
  })

  it('exports items with correct CSV headers and rows', () => {
    const items = [makeItem()]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('id,platform,status,qualityScore,contentPreview,contentType,scheduledTime,generatedBy')
  })

  it('converts qualityScore from 0-1 to 0-100 integer', () => {
    const items = [makeItem({qualityScore: 0.923})]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    const values = lines[1].split(',')
    // qualityScore is at index 3
    expect(values[3]).toBe('92')
  })

  it('truncates content preview to 80 characters', () => {
    const longBody = 'A'.repeat(100)
    const items = [makeItem({content: {title: 'Test', body: longBody, platformMeta: {}}})]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    // The preview should be 77 chars + '...' = 80 chars max
    // Parse the CSV row to get the contentPreview field
    expect(lines[1]).toContain('A'.repeat(77) + '...')
  })

  it('does not truncate short content', () => {
    const shortBody = 'Short content'
    const items = [makeItem({content: {title: 'Test', body: shortBody, platformMeta: {}}})]
    const result = exportToCSV(items)
    expect(result).toContain('Short content')
  })

  it('escapes commas in content preview per RFC 4180', () => {
    const bodyWithComma = 'Hello, world content'
    const items = [makeItem({content: {title: 'Test', body: bodyWithComma, platformMeta: {}}})]
    const result = exportToCSV(items)
    // Field with comma should be wrapped in double quotes
    expect(result).toContain('"Hello, world content"')
  })

  it('escapes double quotes in content preview per RFC 4180', () => {
    const bodyWithQuotes = 'She said "hello" today'
    const items = [makeItem({content: {title: 'Test', body: bodyWithQuotes, platformMeta: {}}})]
    const result = exportToCSV(items)
    // Quotes should be doubled and field wrapped
    expect(result).toContain('"She said ""hello"" today"')
  })

  it('escapes newlines in content preview per RFC 4180', () => {
    const bodyWithNewline = 'Line one\nLine two'
    const items = [makeItem({content: {title: 'Test', body: bodyWithNewline, platformMeta: {}}})]
    const result = exportToCSV(items)
    expect(result).toContain('"Line one\nLine two"')
  })

  it('outputs empty string for missing scheduledTime', () => {
    const items = [makeItem({scheduledTime: undefined})]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    // scheduledTime is index 6 — should be empty
    const values = lines[1].split(',')
    expect(values[6]).toBe('')
  })

  it('includes scheduledTime as ISO 8601 when present', () => {
    const items = [makeItem({scheduledTime: '2026-03-02T09:00:00Z'})]
    const result = exportToCSV(items)
    expect(result).toContain('2026-03-02T09:00:00Z')
  })

  it('exports multiple items as separate rows', () => {
    const items = [
      makeItem({id: 'item-001', platform: 'reddit', generatedBy: 'reddit-creator'}),
      makeItem({id: 'item-002', platform: 'tiktok', generatedBy: 'tiktok-creator'}),
    ]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[1]).toContain('item-001')
    expect(lines[2]).toContain('item-002')
  })

  it('rounds qualityScore correctly for edge values', () => {
    const items = [makeItem({qualityScore: 0.995})]
    const result = exportToCSV(items)
    expect(result).toContain(',100,') // 0.995 * 100 = 99.5 → rounds to 100
  })

  it('handles zero quality score', () => {
    const items = [makeItem({qualityScore: 0})]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    const values = lines[1].split(',')
    expect(values[3]).toBe('0')
  })

  it('includes all CSV field values in correct order', () => {
    const items = [makeItem({
      id: 'item-test-123',
      platform: 'instagram',
      status: 'approved',
      qualityScore: 0.76,
      content: {title: 'Test', body: 'Preview text here', platformMeta: {}},
      contentType: 'trending-derivative',
      scheduledTime: '2026-04-01T15:00:00Z',
      generatedBy: 'ig-creator',
    })]
    const result = exportToCSV(items)
    const lines = result.split('\n')
    expect(lines[1]).toBe('item-test-123,instagram,approved,76,Preview text here,trending-derivative,2026-04-01T15:00:00Z,ig-creator')
  })
})
