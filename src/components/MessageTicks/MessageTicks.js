'use client';

import { CheckIcon, DoubleCheckIcon } from '../Icons';
import styles from './MessageTicks.module.css';

const LABELS = {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Seen',
};

/**
 * WhatsApp-style delivery state for a message you sent.
 *
 * sent      one tick    — stored, nobody has picked it up yet
 * delivered two ticks   — every other participant's app has it
 * read      two accent  — every other participant has opened the thread since
 *
 * In a 3-way swap "every other participant" is the whole group, so the state
 * only advances once the slowest person catches up.
 */
export default function MessageTicks({ state }) {
    if (!state) return null;

    const label = LABELS[state] || LABELS.sent;

    return (
        <span
            className={`${styles.ticks} ${state === 'read' ? styles.read : ''}`}
            title={label}
            aria-label={label}
        >
            {state === 'sent'
                ? <CheckIcon width={14} height={14} strokeWidth={2.5} />
                : <DoubleCheckIcon width={16} height={16} strokeWidth={2.5} />}
        </span>
    );
}
