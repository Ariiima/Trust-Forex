// The join gate's whole ruleset in one table. Run: node --test server/
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TF_GROUP_ID = '-1003891844272';
const { joinVerdict, appButton } = await import('./telegram.mjs');

test('appButton: no bot username means no button, not a broken one', () => {
  delete process.env.TF_BOT_USERNAME;
  assert.deepEqual(appButton(), {});
});

test('appButton: carries the start param into the deep link', () => {
  process.env.TF_BOT_USERNAME = 'Tfyest2838_bot';
  assert.equal(
    appButton('c_camp1').reply_markup.inline_keyboard[0][0].url,
    'https://t.me/Tfyest2838_bot/app?startapp=c_camp1',
  );
  assert.equal(appButton().reply_markup.inline_keyboard[0][0].text, 'Open App');
});

const subscribed = new Set([111]);
const isSubscribed = (id) => subscribed.has(id);

const jr = (fromId, linkName, chatId = -1003891844272) => ({
  chat: { id: chatId },
  from: { id: fromId },
  invite_link: linkName === undefined ? undefined : { name: linkName },
});

test('owner with live subscription is approved', () => {
  assert.equal(joinVerdict(jr(111, 'tf:111'), isSubscribed), 'approve');
});

test('someone else using a forwarded link is declined', () => {
  assert.equal(joinVerdict(jr(222, 'tf:111'), isSubscribed), 'decline');
});

test('owner whose subscription lapsed is declined on re-join', () => {
  assert.equal(joinVerdict(jr(333, 'tf:333'), isSubscribed), 'decline');
});

test('admin-made links and other routes are left alone', () => {
  assert.equal(joinVerdict(jr(111, 'vip friends'), isSubscribed), null);
  assert.equal(joinVerdict(jr(111, undefined), isSubscribed), null);
});

test('requests for a different chat are ignored', () => {
  assert.equal(joinVerdict(jr(111, 'tf:111', -100999), isSubscribed), null);
});
