import {chromium, expect} from '@playwright/test';
import fs from 'node:fs';
import {api, password, base, utc, php, queryString, future} from './helpers.mjs';

const fixtures = JSON.parse(fs.readFileSync('test-results/fixtures.json', 'utf8'));
const agent = [fixtures.users.agentA.userName, password];
const run = Date.now();
await api(`Preferences/${fixtures.users.agentA.id}`, {method: 'PUT', user: agent, data: {timeZone: 'America/Caracas'}});
const legacy = await api('DovAgentNote', {method: 'POST', user: agent, data: {description: `Existing callback ${run}`, isCallback: true, dateStart: future(), reminderMinutes: 5}});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1500, height: 1050}});
const page = await context.newPage();
const errors = [];
const frames = [];
let checks = 0;
const pass = message => { checks++; console.log('PASS', message); };
page.on('websocket', socket => socket.on('framereceived', event => frames.push(event.payload.toString())));
page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
const find = text => api('DovAgentNote?' + queryString({where: [{type: 'textFilter', value: text}]}), {user: agent});
try {
    await page.goto(base);
    await page.locator('#field-userName').fill(agent[0]);
    await page.locator('#field-password').fill(agent[1]);
    await page.locator('#btn-login').click();
    await page.locator('[data-action="toggleNotepad"]').waitFor({timeout: 30000});
    await page.locator('[data-action="toggleNotepad"]').click();
    const panel = page.locator('#espo-notes-panel-root');
    const row = key => panel.locator(`[data-row-key="${key}"]`);
    await expect(row(legacy.id).locator('[name="description"]')).toHaveValue(`Existing callback ${run}`);
    if (php('reminders', legacy.id).length !== 1) throw new Error('Existing reminder was not retained');
    pass('existing callback and reminder appear on the unified page');

    await panel.locator('[data-action="newCallback"]').click();
    await row('new-1').locator('[name="description"]').fill(`Callback A ${run}`);
    const nextDay = new Date(Date.now() - 4 * 3600000 + 86400000).toISOString().slice(0, 10);
    const dateA = `${nextDay}T23:30`;
    const dateB = `${nextDay}T23:45`;
    await row('new-1').locator('[name="localDate"]').fill(dateA);
    await row('new-1').locator('[name="reminderMinutes"]').selectOption('5');
    await panel.locator('[data-action="newCallback"]').click();
    await row('new-2').locator('[name="description"]').fill(`Callback B ${run}`);
    await row('new-2').locator('[name="localDate"]').fill(dateB);
    await row('new-2').locator('[name="reminderMinutes"]').selectOption('15');
    await row('new-2').locator('[name="description"]').press('Control+Enter');
    await expect(panel.locator('.espo-notes-notice')).toHaveText('Saved 2 callback rows.');
    const a = (await find(`Callback A ${run}`)).list[0];
    const b = (await find(`Callback B ${run}`)).list[0];
    if (!a || !b || php('reminders', a.id)[0].seconds !== 300 || php('reminders', b.id)[0].seconds !== 900) throw new Error('Independent reminders failed');
    if (a.dateStart !== utc(new Date(dateA + '-04:00')) || a.dateStart.slice(0, 10) <= nextDay) throw new Error('Caracas UTC date boundary failed');
    pass('two inline callbacks save together with separate dates and reminders');

    await row('new-1').locator('[name="description"]').fill(`Draft A ${run}`);
    await row('new-2').locator('[name="description"]').fill(`Draft B ${run}`);
    await panel.locator('[data-action="close"]').click();
    await page.getByRole('button', {name: 'Keep drafts and close', exact: true}).click();
    await page.locator('[data-action="toggleNotepad"]').click();
    await expect(row('new-1').locator('[name="description"]')).toHaveValue(`Draft A ${run}`);
    await expect(row('new-2').locator('[name="description"]')).toHaveValue(`Draft B ${run}`);
    pass('multiple unsaved row drafts survive closing and reopening');

    await page.route(`**/api/v1/DovAgentNote/${a.id}`, async route => {
        if (route.request().method() === 'PUT') await route.fulfill({status: 503, contentType: 'application/json', body: '{}'});
        else await route.continue();
    });
    await panel.locator('[data-action="saveAll"]').click();
    await expect(panel.locator('.espo-notes-notice')).toHaveText('Saved 1 of 2 rows. Unsaved rows keep your changes.');
    await expect(row('new-1').locator('.espo-notes-row-error')).toBeVisible();
    await expect(row('new-1').locator('[name="description"]')).toHaveValue(`Draft A ${run}`);
    if ((await api(`DovAgentNote/${b.id}`, {user: agent})).description !== `Draft B ${run}`) throw new Error('Other row failed to save');
    await page.unroute(`**/api/v1/DovAgentNote/${a.id}`);
    await panel.locator('[data-action="saveAll"]').click();
    await expect(panel.locator('.espo-notes-notice')).toHaveText('Saved 1 callback rows.');
    pass('partial save reports failures, preserves drafts, and retries only unsaved rows');

    await api(`DovAgentNote/${b.id}`, {method: 'PUT', user: agent, data: {description: `Remote change ${run}`}});
    await row('new-2').locator('[name="description"]').fill(`Stale edit ${run}`);
    await row('new-2').locator('[data-action="rowSave"]').click();
    await expect(row('new-2').locator('.espo-notes-row-error')).toContainText('changed in another tab');
    await expect(row('new-2').locator('[name="description"]')).toHaveValue(`Stale edit ${run}`);
    await row('new-1').locator('[name="description"]').fill(`Protected other draft ${run}`);
    await row('new-2').locator('[data-action="rowReload"]').click();
    await page.locator('.modal').getByRole('button', {name: 'Reload row', exact: true}).click();
    await expect(row('new-2').locator('[name="description"]')).toHaveValue(`Remote change ${run}`);
    await expect(row('new-1').locator('[name="description"]')).toHaveValue(`Protected other draft ${run}`);
    await panel.locator('[data-action="saveAll"]').click();
    await expect(panel.locator('.espo-notes-notice')).toHaveText('Saved 1 callback rows.');
    pass('stale edits are rejected and reloading one row preserves other drafts');

    await row('new-1').locator('[name="done"]').check();
    await expect(row('new-1')).toHaveCount(0);
    if (php('reminders', a.id).length !== 0 || php('reminders', b.id).length !== 1) throw new Error('Completion affected another reminder');
    await panel.locator('[name="showHistory"]').check();
    await expect(row('new-1').locator('[name="done"]')).toBeChecked();
    await row('new-1').locator('[data-action="rowReschedule"]').click();
    await row('new-1').locator('[name="localDate"]').fill(dateA);
    await row('new-1').locator('[data-action="rowSave"]').click();
    await expect(row('new-1').locator('.espo-notes-row-state')).toHaveText('Saved');
    if (php('reminders', a.id).length !== 1) throw new Error('Reschedule failed');
    pass('row completion cancels only its own reminder and history supports rescheduling');

    const lead = await api('Lead', {method: 'POST', user: agent, data: {lastName: `Notebook lead ${run}`}});
    await page.goto(`${base}/#Lead/view/${lead.id}`);
    await expect(page.locator('#main .page-header')).toContainText(`Notebook lead ${run}`);
    if (!await panel.isVisible()) await page.locator('[data-action="toggleNotepad"]').click();
    await row('new-2').locator('summary').click();
    await row('new-2').locator('[data-action="rowCurrentRecord"]').click();
    await expect(row('new-2').locator('.espo-notes-row-parent')).toHaveText(`Notebook lead ${run}`);
    await row('new-2').locator('[data-action="rowSave"]').click();
    await expect(row('new-2').locator('.espo-notes-row-state')).toHaveText('Saved');
    if ((await api(`DovAgentNote/${b.id}`, {user: agent})).parentId !== lead.id) throw new Error('Row parent link failed');
    pass('each callback row can independently link the current CRM record');

    await panel.locator('[data-action="newCallback"]').click();
    await panel.locator('[data-action="saveAll"]').click();
    await expect(row('new-3').locator('.espo-notes-row-error')).toHaveText('Enter callback notes.');
    await expect(panel.locator('.espo-notes-notice')).toHaveText('Fix the highlighted rows. Nothing was saved.');
    await row('new-3').locator('[data-action="rowRemove"]').click();
    await expect(row('new-3')).toHaveCount(0);
    pass('blank rows prevent bulk saving and can be removed without changing saved callbacks');

    await page.screenshot({path: 'test-results/notepad-desktop.png'});
    await page.setViewportSize({width: 390, height: 844});
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
    await row('new-2').locator('[name="description"]').scrollIntoViewIfNeeded();
    await page.screenshot({path: 'test-results/notepad-mobile.png'});
    pass('the same callback page works on narrow screens');
    await page.setViewportSize({width: 1500, height: 1050});
    await page.reload();
    await page.locator('[data-action="toggleNotepad"]').click();
    await expect(row(a.id).locator('[name="description"]')).toHaveValue(`Protected other draft ${run}`);
    await expect(row(b.id).locator('[name="description"]')).toHaveValue(`Remote change ${run}`);
    if ((await find(`Protected other draft ${run}`)).total !== 1) throw new Error('Duplicate saved row');
    pass('saved rows persist across reload without duplicate callback records');

    await panel.locator('#espo-notes-search').fill(`Remote change ${run}`);
    await expect(panel.locator('.espo-notes-row')).toHaveCount(1);
    await expect(row(b.id)).toBeVisible();
    await panel.locator('#espo-notes-search').fill('');
    await expect(row(a.id)).toBeVisible();
    pass('page search filters callbacks without opening individual notes');

    const paged = [];
    for (let offset = 0; offset < 51; offset += 6) {
        paged.push(...await Promise.all(Array.from({length: Math.min(6, 51 - offset)}, (_, i) => api('DovAgentNote', {
            method: 'POST', user: agent, data: {description: `Extra callback ${offset + i} ${run}`,
                isCallback: true, dateStart: future(2880 + offset + i), reminderMinutes: -1},
        }))));
    }
    await panel.locator('[data-action="refresh"]').click();
    await expect(panel.locator('[data-action="more"]')).toBeVisible();
    for (let pageNumber = 0; pageNumber < 20 && await panel.locator('[data-action="more"]').isVisible(); pageNumber++) {
        const count = await panel.locator('.espo-notes-row').count();
        await panel.locator('[data-action="more"]').click();
        await expect.poll(async () => await panel.locator('.espo-notes-row').count() > count || !await panel.locator('[data-action="more"]').isVisible()).toBe(true);
    }
    await expect(row(paged.at(-1).id).locator('[name="description"]')).toHaveValue(`Extra callback 50 ${run}`);
    await expect(panel.locator('[data-action="more"]')).toBeHidden();
    pass('Load more includes all callbacks when an agent has more than 50 rows');

    const popup = await api('DovAgentNote', {method: 'POST', user: agent, data: {description: `Notebook popup ${run}`, isCallback: true, dateStart: utc(new Date(Date.now() + 4000)), reminderMinutes: 0}});
    await new Promise(resolve => setTimeout(resolve, 5000));
    php('submit-popups');
    await expect.poll(() => frames.some(frame => frame.includes(popup.id)), {timeout: 10000}).toBe(true);
    await expect(page.getByText(`Notebook popup ${run}`, {exact: true})).toBeVisible();
    await api(`DovAgentNote/${popup.id}`, {method: 'PUT', user: agent, data: {status: 'Completed'}});
    pass('native WebSocket callback reminders still render');

    await panel.locator('[data-action="fullList"]').click();
    await expect(page.locator('#main .page-header')).toContainText('Agent Notes');
    const managerContext = await browser.newContext();
    const manager = await managerContext.newPage();
    await manager.goto(base);
    await manager.locator('#field-userName').fill(fixtures.users.manager.userName);
    await manager.locator('#field-password').fill(password);
    await manager.locator('#btn-login').click();
    await manager.locator('[data-action="toggleNotepad"]').waitFor();
    await manager.goto(`${base}/#DovAgentNote/view/${b.id}`);
    await expect(manager.locator('#main .page-header')).toContainText(`Remote change ${run}`);
    await expect(manager.locator('#main [data-action="edit"]')).toBeHidden();
    await manager.screenshot({path: 'test-results/manager-read-only.png'});
    await managerContext.close();
    pass('manager review remains read-only');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Browser integration: ${checks} workflow checks passed.`);
} catch (error) {
    await page.screenshot({path: 'test-results/browser-failure.png'});
    fs.writeFileSync('test-results/browser-failure.html', await page.content());
    throw error;
} finally { await browser.close(); }
