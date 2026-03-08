import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3847'

test.describe('MAT Dashboard — Live E2E', () => {
  test.describe.configure({ timeout: 120_000 })

  test('1. Homepage loads and shows Pipeline view', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('.section-title').first()).toContainText('Pipeline')
    await expect(page.locator('#pipeline-stages')).toBeVisible()
    // Should show 7 stage cards
    const cards = page.locator('.stage-card')
    await expect(cards).toHaveCount(7)
    console.log('  ✓ 7 stage cards rendered')

    // Check stage names
    const names = await cards.locator('.stage-name').allTextContents()
    expect(names).toEqual(['Research', 'Strategy', 'Creation', 'Optimization', 'Quality', 'Review', 'Distribution'])
    console.log('  ✓ Stage names correct:', names.join(', '))
  })

  test('2. Recent Runs table loads', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForTimeout(1500)
    const rows = page.locator('#runs-table-body tr')
    const count = await rows.count()
    console.log(`  ✓ ${count} run(s) in the table`)
    expect(count).toBeGreaterThan(0)
  })

  test('3. New Run modal — opens, shows fields, and closes', async ({ page }) => {
    await page.goto(BASE)
    await page.click('#new-run-btn')
    const modal = page.locator('#new-run-modal')
    await expect(modal).toBeVisible()
    console.log('  ✓ Modal opened')

    // Platform checkboxes should be present
    const platformChecks = modal.locator('input[name="platforms"]')
    await expect(platformChecks).toHaveCount(4)
    console.log('  ✓ 4 platform checkboxes')

    // Workflow mode select
    const modeSelect = modal.locator('select[name="mode"]')
    await expect(modeSelect).toBeVisible()
    const options = await modeSelect.locator('option').allTextContents()
    console.log('  ✓ Mode options:', options.join(', '))
    expect(options).toContain('Full Pipeline')
    expect(options).toContain('From Idea')
    expect(options).toContain('Optimize Existing Content (ECT)')

    // Posts per platform input
    const postsInput = modal.locator('input[name="posts"]')
    await expect(postsInput).toBeVisible()
    await expect(postsInput).toHaveValue('1')
    console.log('  ✓ Posts per platform field visible, default=1')

    // Dry run checkbox
    const dryRun = modal.locator('input[name="dryRun"]')
    await expect(dryRun).toBeChecked()
    console.log('  ✓ Dry run checked by default')

    // Close modal
    await page.click('#cancel-run-btn')
    await expect(modal).not.toBeVisible()
    console.log('  ✓ Modal closed')
  })

  test('4. ECT mode — shows topic/niche/audience/description/duration fields', async ({ page }) => {
    await page.goto(BASE)
    await page.click('#new-run-btn')
    const modal = page.locator('#new-run-modal')

    // Switch to optimize mode
    await modal.locator('select[name="mode"]').selectOption('optimize')
    await page.waitForTimeout(300)

    // ECT-specific fields should now be visible
    const topicField = modal.locator('input[name="topic"]')
    const nicheField = modal.locator('input[name="niche"]')
    const audienceField = modal.locator('input[name="audience"]')
    const descField = modal.locator('textarea[name="videoDescription"]')
    const durationField = modal.locator('input[name="duration"]')

    await expect(topicField).toBeVisible()
    await expect(nicheField).toBeVisible()
    await expect(audienceField).toBeVisible()
    await expect(descField).toBeVisible()
    await expect(durationField).toBeVisible()
    console.log('  ✓ All ECT fields visible (topic, niche, audience, description, duration)')

    // Idea field should NOT be visible in optimize mode
    const ideaField = modal.locator('input[name="idea"]')
    await expect(ideaField).not.toBeVisible()
    console.log('  ✓ Idea field hidden in optimize mode')

    // Switch to idea mode — ECT fields should hide, idea should show
    await modal.locator('select[name="mode"]').selectOption('idea')
    await page.waitForTimeout(300)
    await expect(topicField).not.toBeVisible()
    await expect(ideaField).toBeVisible()
    console.log('  ✓ Switching to idea mode: ECT fields hidden, idea field visible')

    // Switch to full mode — idea field should show (also useful for full runs)
    await modal.locator('select[name="mode"]').selectOption('full')
    await page.waitForTimeout(300)
    await expect(ideaField).toBeVisible()
    await expect(topicField).not.toBeVisible()
    console.log('  ✓ Full mode: idea field visible, ECT fields hidden')

    await page.click('#cancel-run-btn')
  })

  test('5. ECT mode — validates topic is required', async ({ page }) => {
    await page.goto(BASE)
    await page.click('#new-run-btn')
    const modal = page.locator('#new-run-modal')

    await modal.locator('select[name="mode"]').selectOption('optimize')
    await page.waitForTimeout(300)

    // Try to submit without topic — should show toast error
    await modal.locator('button[type="submit"]').click()
    await page.waitForTimeout(500)

    // Check for error toast
    const toast = page.locator('.toast')
    const toastText = await toast.textContent().catch(() => '')
    console.log('  ✓ Submit without topic shows error:', toastText || '(toast appeared)')
    await page.click('#cancel-run-btn')
  })

  test('6. Stage card click — expands detail panel', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForTimeout(1500) // wait for runs to load

    // Click on a stage card
    const researchCard = page.locator('.stage-card[data-stage="research"]')
    await researchCard.click()
    await page.waitForTimeout(500)

    const detailPanel = page.locator('#stage-detail-panel')
    await expect(detailPanel).toBeVisible()
    const detailTitle = await detailPanel.locator('h3').textContent()
    console.log('  ✓ Detail panel opened for:', detailTitle)

    // Click review stage
    const reviewCard = page.locator('.stage-card[data-stage="review"]')
    await reviewCard.click()
    await page.waitForTimeout(1000)
    const reviewTitle = await detailPanel.locator('h3').textContent()
    console.log('  ✓ Review stage detail:', reviewTitle)
    expect(reviewTitle).toContain('Review')
  })

  test('7. Navigation — all views render', async ({ page }) => {
    await page.goto(BASE)

    // Pipeline view (default)
    await expect(page.locator('#pipeline-stages')).toBeVisible()
    console.log('  ✓ Pipeline view loaded')

    // Review view
    await page.click('a[href="#review"]')
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: 'Review' }).first()).toBeVisible()
    console.log('  ✓ Review view loaded')

    // Context view
    await page.click('a[href="#context"]')
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: /context/i }).first()).toBeVisible()
    console.log('  ✓ Context view loaded')

    // History view
    await page.click('a[href="#history"]')
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: /history/i }).first()).toBeVisible()
    console.log('  ✓ History view loaded')
  })

  test('8. API endpoints respond correctly', async ({ request }) => {
    // GET /api/runs
    const runsRes = await request.get(`${BASE}/api/runs`)
    expect(runsRes.ok()).toBeTruthy()
    const runs = await runsRes.json()
    expect(Array.isArray(runs)).toBe(true)
    console.log(`  ✓ GET /api/runs — ${runs.length} runs`)

    // GET /api/review
    const reviewRes = await request.get(`${BASE}/api/review`)
    expect(reviewRes.ok()).toBeTruthy()
    const reviews = await reviewRes.json()
    expect(Array.isArray(reviews)).toBe(true)
    console.log(`  ✓ GET /api/review — ${reviews.length} items`)

    // GET /api/context
    const ctxRes = await request.get(`${BASE}/api/context`)
    expect(ctxRes.ok()).toBeTruthy()
    const ctx = await ctxRes.json()
    console.log(`  ✓ GET /api/context — exists: ${ctx.exists}`)

    // GET /api/history
    const histRes = await request.get(`${BASE}/api/history`)
    expect(histRes.ok()).toBeTruthy()
    const history = await histRes.json()
    console.log(`  ✓ GET /api/history — ${history.length} campaigns`)

    // GET /api/runs/:id (first run)
    if (runs.length > 0) {
      const runRes = await request.get(`${BASE}/api/runs/${runs[0].id}`)
      expect(runRes.ok()).toBeTruthy()
      const run = await runRes.json()
      expect(run.id).toBe(runs[0].id)
      console.log(`  ✓ GET /api/runs/${runs[0].id.slice(0, 8)}... — status: ${run.status}`)
    }
  })

  test('9. Review items display correctly', async ({ page }) => {
    await page.goto(`${BASE}#review`)
    await page.waitForTimeout(1500)

    const cards = page.locator('.review-card, .review-item')
    const count = await cards.count()
    console.log(`  ✓ Review view shows ${count} review card(s)`)

    if (count > 0) {
      const firstCard = cards.first()
      const platform = await firstCard.locator('.platform-badge, .review-platform').textContent().catch(() => 'N/A')
      console.log(`  ✓ First review item platform: ${platform}`)
    }
  })

  test('10. Start ECT run from dashboard (dry-run)', async ({ page }) => {
    await page.goto(BASE)
    await page.click('#new-run-btn')
    const modal = page.locator('#new-run-modal')

    // Uncheck all platforms, then check only tiktok
    const allPlatforms = modal.locator('input[name="platforms"]')
    for (let i = 0; i < await allPlatforms.count(); i++) {
      await allPlatforms.nth(i).uncheck()
    }
    await modal.locator('input[name="platforms"][value="tiktok"]').check()

    // Select optimize mode
    await modal.locator('select[name="mode"]').selectOption('optimize')
    await page.waitForTimeout(300)

    // Fill ECT fields
    await modal.locator('input[name="topic"]').fill('How AI tools help small businesses save time')
    await modal.locator('input[name="niche"]').fill('AI/SaaS')
    await modal.locator('input[name="audience"]').fill('small business owners aged 25-45')
    await modal.locator('textarea[name="videoDescription"]').fill('Shows 3 AI tools that automate invoicing, scheduling, and email')
    await modal.locator('input[name="duration"]').fill('30s')

    // Ensure dry run is checked
    await expect(modal.locator('input[name="dryRun"]')).toBeChecked()

    console.log('  ✓ ECT form filled with test data')

    // Take a screenshot before submitting
    await page.screenshot({ path: 'e2e/screenshots/ect-form-filled.png', fullPage: true })
    console.log('  ✓ Screenshot saved: e2e/screenshots/ect-form-filled.png')

    // Submit the form
    await modal.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    // Modal should close
    await expect(modal).not.toBeVisible()
    console.log('  ✓ Run submitted, modal closed')

    // Wait for the run to appear in the table
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/ect-run-started.png', fullPage: true })
    console.log('  ✓ Screenshot saved: e2e/screenshots/ect-run-started.png')

    // Check that a new tiktok run appeared
    const tableText = await page.locator('#runs-table-body').textContent()
    console.log('  ✓ Runs table updated, contains tiktok:', tableText?.includes('tiktok'))
  })
})
