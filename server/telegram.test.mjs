// The join gate's whole ruleset in one table. Run: node --test server/
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TF_GROUP_ID = '-1003891844272';
const { joinVerdict, appButton, inviteLinkCall, clean } = await import('./telegram.mjs');

test('appButton: no bot username means no button, not a broken one', () => {
  delete process.env.TF_BOT_USERNAME;
  assert.deepEqual(appButton(), {});
});

test('appButton: carries the start param into the deep link', () => {
  process.env.TF_BOT_USERNAME = 'Tfyest2838_bot';
  assert.equal(
    appButton('c_camp1').reply_markup.inline_keyboard[0][0].url,
    'https://t.me/Tfyest2838_bot?startapp=c_camp1',
  );
  assert.equal(appButton().reply_markup.inline_keyboard[0][0].text, 'Open App');
});

test('clean: editor HTML → the HTML Telegram accepts', () => {
  assert.equal(clean('Hi <b>{name}</b>,&nbsp;try again.<br>'), 'Hi <b>{name}</b>, try again.');
  // Chrome/paste express marks as styles; Telegram only knows the tags.
  assert.equal(clean('<span style="font-weight: 700;">bold</span> <span style="font-style: italic; text-decoration: underline">iu</span>'),
    '<b>bold</b> <i><u>iu</u></i>');
  assert.equal(clean('<div>one</div><div><blockquote style="margin:0">quoted</blockquote>two</div>'),
    'one\n<blockquote>quoted</blockquote>\ntwo');
  // Attributes are stripped; a schemeless link gets one, an anchor without href goes.
  assert.equal(clean('<b class="x">a</b> <a href="bestoftelegram.com" target="_blank">here</a> <a name="n">x</a>'),
    '<b>a</b> <a href="https://bestoftelegram.com">here</a> x');
  assert.equal(clean('<ul><li>a</li><li>b</li></ul><font color="red">c</font>'), 'a\nb\nc');
});

test('clean: a block STARTS a line, it does not only end one', () => {
  // Enter in a contenteditable: the break belongs before the div's text, not
  // after it. Emitting it at </div> alone shipped "…get started.test".
  assert.equal(clean('Welcome 👋<div>test</div>'), 'Welcome 👋\ntest');
  assert.equal(clean('one<div>two</div><div>three</div>'), 'one\ntwo\nthree');
  // An empty line is a <div> holding nothing but a <br>, and stays empty.
  assert.equal(clean('one<div><br></div><div>two</div>'), 'one\n\ntwo');
  // A boundary swallows the spaces around it rather than ending a line in one.
  assert.equal(clean('one <div> two</div>'), 'one\ntwo');
  // Half a line quoted: the quote is its own block, the rest carries on.
  assert.equal(clean('Renew now.<div><blockquote>keep VIP</blockquote> and cashback.</div>'),
    'Renew now.\n<blockquote>keep VIP</blockquote>\nand cashback.');
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

test('groupInvite edits the stored link instead of minting a new one', () => {
  const [method, params] = inviteLinkCall('https://t.me/+abc', 111);
  assert.equal(method, 'editChatInviteLink');
  assert.equal(params.invite_link, 'https://t.me/+abc');
  assert.equal(params.name, 'tf:111');
});

test('groupInvite mints fresh only when no link is on file yet', () => {
  const [method, params] = inviteLinkCall(null, 111);
  assert.equal(method, 'createChatInviteLink');
  assert.equal(params.creates_join_request, true);
  assert.equal(params.name, 'tf:111');
});

test('invite links never carry an expiry — the join gate is the only check', () => {
  for (const existing of [null, 'https://t.me/+abc']) {
    const [, params] = inviteLinkCall(existing, 111);
    assert.equal(params.expire_date, undefined);
    assert.equal(params.member_limit, undefined);
  }
});

/* editChatInviteLink resets what it is not given: an edit that forgets this
   flag turns the link into a direct-join one and the gate never runs. */
test('both the mint and the edit keep creates_join_request', () => {
  for (const existing of [null, 'https://t.me/+abc']) {
    const [, params] = inviteLinkCall(existing, 111);
    assert.equal(params.creates_join_request, true);
  }
});
