import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, HelpCircle } from 'lucide-react';
import './InfoPopover.css';

export interface InfoPopoverProps {
    title: string;
    children: React.ReactNode;
    variant?: 'craftlab' | 'forwardbooking';
}

export function InfoPopover({ title, children, variant = 'craftlab' }: InfoPopoverProps) {
    const [open, setOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    // Detect mobile (<640px)
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // Focus close button when popover opens
    useEffect(() => {
        if (open) {
            // Small delay so the DOM is ready
            const t = setTimeout(() => closeRef.current?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [open]);

    const close = useCallback(() => {
        setOpen(false);
        triggerRef.current?.focus();
    }, []);

    // Close on Escape + focus trap
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }
            // Focus trap inside popover
            if (e.key === 'Tab' && popoverRef.current) {
                const focusable = Array.from(
                    popoverRef.current.querySelectorAll<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    )
                );
                if (focusable.length === 0) { e.preventDefault(); return; }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                } else {
                    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, close]);

    // Close on click outside (desktop popover only)
    useEffect(() => {
        if (!open || isMobile) return;
        const handleClick = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)
            ) {
                close();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open, isMobile, close]);

    const content = (
        <div
            ref={popoverRef}
            className={`info-popover-content info-popover-content--${variant} ${isMobile ? 'info-popover-content--sheet' : 'info-popover-content--inline'}`}
            role="dialog"
            aria-modal={isMobile ? 'true' : 'false'}
            aria-labelledby="ipop-title"
        >
            {isMobile && <div className="info-popover-handle" aria-hidden="true" />}
            <div className="info-popover-header">
                <span id="ipop-title" className="info-popover-title">{title}</span>
                <button
                    ref={closeRef}
                    className="info-popover-close"
                    onClick={close}
                    aria-label="Close info"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="info-popover-body">{children}</div>
            {!isMobile && <div className="info-popover-arrow" aria-hidden="true" />}
        </div>
    );

    return (
        <span className="info-popover-wrapper">
            <button
                ref={triggerRef}
                className={`info-popover-trigger info-popover-trigger--${variant}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`Learn more about ${title}`}
                onClick={() => setOpen(prev => !prev)}
                type="button"
            >
                <HelpCircle size={16} />
            </button>

            {/* Desktop: inline positioned popover */}
            {open && !isMobile && (
                <div className="info-popover-inline-wrapper">
                    {content}
                </div>
            )}

            {/* Mobile: bottom sheet with backdrop */}
            {open && isMobile && (
                <>
                    <div
                        className="info-popover-backdrop"
                        onClick={close}
                        aria-hidden="true"
                    />
                    {content}
                </>
            )}
        </span>
    );
}
