'use client';

import { useMemo, useState } from 'react';
import styles from './TemplatePicker.module.css';

const CATEGORIES = [
    { key: 'scheduling', label: 'Timing' },
    { key: 'live', label: 'Doing it now' },
    { key: 'status', label: 'Status' },
    { key: 'courtesy', label: 'Courtesy' },
];

const SLOT_LABELS = {
    day: 'Which day?',
    time: 'What time?',
    section: 'Which section?',
    minutes: 'How long?',
};

// Fill what's been picked so far; anything still missing shows as a blank.
function preview(template, values) {
    return template.body_template.replace(/\{([a-z_]+)\}/g, (match, slot) =>
        values[slot] || '…'
    );
}

/**
 * The only way to put a message in a thread. There is no text input anywhere:
 * you pick a sentence, then pick values for whatever blanks it has. The server
 * re-validates both against the same catalogue, so nothing typed can get through.
 */
export default function TemplatePicker({ templates, disabled, disabledNote, onSend }) {
    const [category, setCategory] = useState('scheduling');
    const [draft, setDraft] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const byCategory = useMemo(() => {
        const groups = {};
        for (const t of templates) {
            (groups[t.category] ||= []).push(t);
        }
        return groups;
    }, [templates]);

    const visibleCategories = CATEGORIES.filter(c => (byCategory[c.key] || []).length > 0);

    if (disabled) {
        return (
            <div className={styles.composer}>
                <p className={styles.closedNote}>{disabledNote || 'This conversation is closed.'}</p>
            </div>
        );
    }

    const slotsOf = (t) => (Array.isArray(t.slots) ? t.slots : []);

    const startDraft = (template) => {
        setError('');
        if (slotsOf(template).length === 0) {
            send(template, {});
            return;
        }
        setDraft({ template, values: {} });
    };

    const pickValue = (slot, value) => {
        setDraft((d) => {
            const values = { ...d.values, [slot]: value };
            return { ...d, values };
        });
    };

    const send = async (template, values) => {
        setSending(true);
        setError('');
        try {
            await onSend(template.key, values);
            setDraft(null);
        } catch (e) {
            setError(e?.message || 'Could not send. Try again.');
        } finally {
            setSending(false);
        }
    };

    if (draft) {
        const slots = slotsOf(draft.template);
        const pending = slots.find((s) => !draft.values[s]);
        const options = pending ? (draft.template.slot_options?.[pending] || []) : [];

        return (
            <div className={styles.composer}>
                <div className={styles.draftHead}>
                    <button
                        type="button"
                        className={styles.backLink}
                        onClick={() => { setDraft(null); setError(''); }}
                    >
                        Cancel
                    </button>
                    <span className={styles.draftPreview}>{preview(draft.template, draft.values)}</span>
                </div>

                {pending ? (
                    <>
                        <p className={styles.slotLabel}>{SLOT_LABELS[pending] || pending}</p>
                        {options.length === 0 ? (
                            <p className={styles.closedNote}>No options available for this swap.</p>
                        ) : (
                            <div className={styles.chipScroll}>
                                {options.map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        className={styles.chip}
                                        onClick={() => pickValue(pending, opt)}
                                    >
                                        {pending === 'minutes' ? `${opt} min` : opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <button
                        type="button"
                        className={styles.sendBtn}
                        disabled={sending}
                        onClick={() => send(draft.template, draft.values)}
                    >
                        {sending ? 'Sending…' : 'Send'}
                    </button>
                )}

                {error && <p className={styles.error}>{error}</p>}
            </div>
        );
    }

    return (
        <div className={styles.composer}>
            <div className={styles.tabs}>
                {visibleCategories.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className={`${styles.tab} ${category === c.key ? styles.tabActive : ''}`}
                        onClick={() => setCategory(c.key)}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            <div className={styles.chipScroll}>
                {(byCategory[category] || []).map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={styles.chip}
                        disabled={sending}
                        onClick={() => startDraft(t)}
                        title={t.body_template.replace(/\{[a-z_]+\}/g, '…')}
                    >
                        {t.label}
                        {slotsOf(t).length > 0 && <span className={styles.chipHint}>···</span>}
                    </button>
                ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}
        </div>
    );
}
