import { useEffect, useRef } from 'react';
import './ExitConfirmModal.css';

interface ExitConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'craftlab' | 'forwardbooking';
}

export function ExitConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Leave without saving?',
    message = 'If you leave now, all your selections will be lost.',
    confirmLabel = 'Yes, leave without saving',
    cancelLabel = 'No, stay',
    variant = 'craftlab',
}: ExitConfirmModalProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);

    // Focus on cancel (safer default) when modal opens
    useEffect(() => {
        if (isOpen) {
            cancelRef.current?.focus();
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
                return;
            }
            // Focus trap: Tab cycles between cancel and confirm only
            if (e.key === 'Tab') {
                const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
                const current = document.activeElement;
                const currentIndex = focusable.indexOf(current as HTMLButtonElement);
                if (currentIndex === -1) return;
                e.preventDefault();
                const next = e.shiftKey
                    ? focusable[(currentIndex - 1 + focusable.length) % focusable.length]
                    : focusable[(currentIndex + 1) % focusable.length];
                next?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="exit-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-modal-title"
            aria-describedby="exit-modal-message"
            onClick={onCancel}
        >
            <div
                className="exit-modal-box"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="exit-modal-title" className="exit-modal-title">
                    {title}
                </h2>
                <p id="exit-modal-message" className="exit-modal-message">
                    {message}
                </p>
                <div className="exit-modal-actions">
                    <button
                        ref={confirmRef}
                        className={`exit-modal-btn-confirm variant-${variant}`}
                        onClick={onConfirm}
                        aria-label={confirmLabel}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        ref={cancelRef}
                        className="exit-modal-btn-cancel"
                        onClick={onCancel}
                        aria-label={cancelLabel}
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
