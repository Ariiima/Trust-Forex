/**
 * "Events and notes" rail — shared by the broker chart and the subscription
 * dashboard frames, including the add and detail modals.
 */
import { useState } from 'react';
import { api, type EventIcon, type EventNote } from '../data';
import {
  AnimatePresence, Button, Card, Confirm, DateInput, Field, Icon, Modal, Skeleton, TextInput, Textarea,
  type IconName,
} from '../ui';

const ICON_TONE: Record<EventIcon, string> = {
  'check-circle': '#22c55e',
  megaphone: '#2563eb',
  alert: '#f59e0b',
  calendar: '#0d9488',
  file: '#7c3aed',
  info: '#0284c7',
  'trending-up': '#db2777',
  settings: '#7c3aed',
};

const PICKABLE: EventIcon[] = ['check-circle', 'megaphone', 'alert', 'calendar', 'file'];

function EventIconMark({ icon, size = 32 }: { icon: EventIcon; size?: number }) {
  const color = ICON_TONE[icon];
  return (
    <span
      className="a-event__icon"
      style={{ width: size, height: size, background: `${color}1f`, color }}
    >
      <Icon name={icon as IconName} size={size * 0.55} />
    </span>
  );
}

export default function EventsRail({ events, loading }: { events: EventNote[]; loading?: boolean }) {
  // `events` arrives one render after mount, so it cannot seed useState —
  // local edits win once there are any, otherwise the loaded list shows.
  const [edited, setEdited] = useState<EventNote[] | null>(null);
  const list = edited ?? events;
  const setList = setEdited;
  const [adding, setAdding] = useState(false);
  // Non-null while editing: the add modal doubles as the edit modal.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState<EventNote | null>(null);
  const [deleting, setDeleting] = useState<EventNote | null>(null);

  // Draft state for the add modal.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<EventIcon>('megaphone');
  const [date, setDate] = useState('');

  const reset = () => {
    setTitle(''); setDescription(''); setIcon('megaphone'); setDate('');
    setEditingId(null); setAdding(false);
  };

  const startEdit = (e: EventNote) => {
    setTitle(e.title); setDescription(e.description); setIcon(e.icon); setDate(e.date);
    setEditingId(e.id);
    setOpen(null);
    setAdding(true);
  };

  const save = () => {
    const draft = { title, description, icon, date: date || 'Today' };
    if (editingId) {
      const id = editingId;
      setList(list.map((e) => (e.id === id ? { ...e, ...draft } : e)));
      reset();
      api.updateEvent(id, draft).catch(() => setList(list));
      return;
    }
    // Temporary id until the server hands back the real one.
    setList([{ id: `pending-${Date.now()}`, ...draft }, ...list]);
    reset();
    api.addEvent(draft)
      .then((saved) => setList([saved, ...list]))
      .catch(() => setList(list));
  };

  return (
    <>
      <Card
        title="Events and notes"
        actions={<Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>Add event</Button>}
      >
        <div className="a-events">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="a-event">
                <Skeleton width={32} height={32} radius={16} />
                <span className="a-cell2" style={{ flex: 1, gap: 5 }}>
                  <Skeleton width={`${64 - i * 8}%`} height={11} />
                  <Skeleton width={44} height={9} />
                </span>
              </div>
            ))
            : list.map((e) => (
              <button key={e.id} type="button" className="a-event" onClick={() => setOpen(e)}>
                <EventIconMark icon={e.icon} />
                <span className="a-cell2" style={{ flex: 1 }}>
                  <span className="a-event__title">{e.title}</span>
                  <span className="a-event__date">{e.date}</span>
                </span>
              </button>
            ))}
        </div>
      </Card>

      <AnimatePresence>
        {adding && (
          <Modal
            title={editingId ? 'Edit event' : 'Add event'}
            width={500}
            onClose={reset}
            footer={
              <>
                <Button onClick={reset}>Cancel</Button>
                <Button
                  variant="primary"
                  iconRight={editingId ? 'check' : 'plus'}
                  disabled={!title.trim()}
                  onClick={save}
                >
                  {editingId ? 'Save changes' : 'Add event'}
                </Button>
              </>
            }
          >
            <div className="a-col">
              <Field label="Title" hint={`${title.length} / 30`}>
                <TextInput value={title} onChange={setTitle} maxLength={30} placeholder="Event title" />
              </Field>
              <Field label="Description">
                <Textarea value={description} onChange={setDescription} placeholder="Add event details" rows={4} />
              </Field>
              <div className="a-row" style={{ alignItems: 'flex-end', gap: 24 }}>
                <Field label="Icon">
                  <div className="a-row" style={{ gap: 8 }}>
                    {PICKABLE.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        aria-label={ic}
                        aria-pressed={icon === ic}
                        onClick={() => setIcon(ic)}
                        style={{
                          borderRadius: '50%',
                          padding: 2,
                          outline: icon === ic ? `2px solid ${ICON_TONE[ic]}` : '1px solid var(--admin-border)',
                        }}
                      >
                        <EventIconMark icon={ic} size={34} />
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Date" style={{ flex: 1 }}>
                  <DateInput value={date} onChange={setDate} />
                </Field>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <Modal
            title={open.title}
            subtitle={open.date}
            icon={<EventIconMark icon={open.icon} size={36} />}
            width={520}
            onClose={() => setOpen(null)}
            footer={
              <>
                <Button variant="outline" icon="pencil" onClick={() => startEdit(open)}>Edit</Button>
                <Button variant="danger" icon="trash" onClick={() => setDeleting(open)}>
                  Delete
                </Button>
              </>
            }
          >
            <div className="a-section" style={{ borderTop: 0, paddingTop: 0 }}>
              <div className="a-section__title">Description</div>
              <p className="at-14">{open.description}</p>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleting && (
          <Confirm
            danger
            title="Delete event"
            message={<>Are you sure you want to delete <b style={{ color: 'var(--ink)' }}>{deleting.title}</b>?</>}
            cancelLabel="Cancel"
            confirmLabel="Delete"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              setList(list.filter((e) => e.id !== deleting.id));
              setOpen(null);
              api.deleteEvent(deleting.id).catch(() => setList(list));
              setDeleting(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
