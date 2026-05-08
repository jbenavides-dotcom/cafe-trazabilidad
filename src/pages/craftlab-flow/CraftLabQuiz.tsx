import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Star, Beaker, FlaskConical, Lock, Check } from 'lucide-react';
import './CraftLabQuiz.css';
import confetti from 'canvas-confetti';
import { unlockCraftLab } from '../../lib/user-progress';

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const CLOSED_TANK_SVG = (
    <svg viewBox="0 0 100 140" width="80" height="110" aria-hidden="true">
        <defs>
            <linearGradient id="closedLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="closedBody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f3f4f6" />
                <stop offset="100%" stopColor="#e5e7eb" />
            </linearGradient>
        </defs>
        {/* Body */}
        <rect x="18" y="32" width="64" height="90" rx="8" ry="8" fill="url(#closedBody)" stroke="#9ca3af" strokeWidth="1.5"/>
        <clipPath id="closedClip">
            <rect x="22" y="52" width="56" height="66" rx="4"/>
        </clipPath>
        {/* Liquid body */}
        <rect x="22" y="52" width="56" height="66" rx="4" fill="url(#closedLiquid)" opacity="0.72"/>
        {/* Animated wavy liquid surface */}
        <g clipPath="url(#closedClip)">
            <path fill="url(#closedLiquid)" opacity="0.55">
                <animate attributeName="d"
                    values="
                        M 22 55 Q 36 51, 50 55 Q 64 59, 78 55 L 78 118 L 22 118 Z;
                        M 22 55 Q 36 59, 50 55 Q 64 51, 78 55 L 78 118 L 22 118 Z;
                        M 22 55 Q 36 51, 50 55 Q 64 59, 78 55 L 78 118 L 22 118 Z"
                    dur="3.5s" repeatCount="indefinite"/>
            </path>
        </g>
        {/* Bubbles rising inside liquid (clipped) */}
        <g clipPath="url(#closedClip)">
            <circle cx="34" r="1.8" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="115;55" dur="2.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.8;0" dur="2.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50" r="1.4" fill="rgba(255,255,255,0.65)">
                <animate attributeName="cy" values="118;56" dur="3.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.7;0" dur="3.4s" repeatCount="indefinite"/>
            </circle>
            <circle cx="66" r="2.2" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="116;54" dur="2.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.85;0" dur="2.4s" repeatCount="indefinite"/>
            </circle>
        </g>
        {/* Pressure waves */}
        <path d="M 26 88 Q 35 86, 44 88 Q 53 90, 62 88 Q 70 86, 74 88" stroke="rgba(193,0,74,0.22)" strokeWidth="1.2" fill="none"/>
        <path d="M 26 104 Q 35 102, 44 104 Q 53 106, 62 104 Q 70 102, 74 104" stroke="rgba(193,0,74,0.16)" strokeWidth="1" fill="none"/>
        {/* Lid sealed */}
        <rect x="14" y="22" width="72" height="14" rx="5" fill="#c1004a"/>
        <rect x="20" y="25" width="60" height="5" rx="2" fill="rgba(255,255,255,0.25)"/>
        {/* Lid center bolt */}
        <circle cx="50" cy="29" r="3.5" fill="#9d0038" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
        {/* Pressure gauge */}
        <circle cx="72" cy="44" r="7" fill="#ffffff" stroke="#9ca3af" strokeWidth="1.5"/>
        <circle cx="72" cy="44" r="5.5" fill="#f9fafb" stroke="none"/>
        <line x1="72" y1="44" x2="75" y2="39.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="72" cy="44" r="1.2" fill="#374151"/>
        {/* Lock icon centered on lid */}
        <g transform="translate(41, 8)">
            <rect x="0" y="4" width="14" height="9" rx="2.5" fill="#ffffff" stroke="#c1004a" strokeWidth="1.5"/>
            <path d="M 2.5 4 Q 2.5 0, 7 0 Q 11.5 0, 11.5 4" fill="none" stroke="#c1004a" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="7" cy="8.5" r="1.5" fill="#c1004a"/>
        </g>
        {/* Sealed label */}
        <text x="50" y="136" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="system-ui, sans-serif" letterSpacing="0.08em">SEALED</text>
    </svg>
);

const OPEN_TANK_SVG = (
    <svg viewBox="0 0 100 140" width="80" height="110" aria-hidden="true">
        <defs>
            <linearGradient id="openLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="openBody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f3f4f6" />
                <stop offset="100%" stopColor="#e5e7eb" />
            </linearGradient>
        </defs>
        {/* Body no lid */}
        <rect x="18" y="42" width="64" height="80" rx="8" ry="8" fill="url(#openBody)" stroke="#9ca3af" strokeWidth="1.5"/>
        {/* Open top rim */}
        <rect x="14" y="38" width="72" height="8" rx="4" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1"/>
        {/* Top opening shadow */}
        <ellipse cx="50" cy="42" rx="30" ry="4" fill="#0A1E3F" opacity="0.12"/>
        <clipPath id="openClip">
            <rect x="22" y="58" width="56" height="60" rx="4"/>
        </clipPath>
        {/* Liquid body */}
        <rect x="22" y="58" width="56" height="60" rx="4" fill="url(#openLiquid)" opacity="0.72"/>
        {/* Animated wavy liquid surface */}
        <g clipPath="url(#openClip)">
            <path fill="url(#openLiquid)" opacity="0.55">
                <animate attributeName="d"
                    values="
                        M 22 61 Q 36 57, 50 61 Q 64 65, 78 61 L 78 118 L 22 118 Z;
                        M 22 61 Q 36 65, 50 61 Q 64 57, 78 61 L 78 118 L 22 118 Z;
                        M 22 61 Q 36 57, 50 61 Q 64 65, 78 61 L 78 118 L 22 118 Z"
                    dur="3.2s" repeatCount="indefinite"/>
            </path>
            {/* Bubbles inside rising */}
            <circle cx="34" r="1.6" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="115;60" dur="2.6s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.8;0" dur="2.6s" repeatCount="indefinite"/>
            </circle>
            <circle cx="60" r="2" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="117;58" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.85;0" dur="3s" repeatCount="indefinite"/>
            </circle>
        </g>
        {/* Escaping bubbles animated */}
        <circle cx="38" cy="38" r="3.5" fill="rgba(29,78,216,0.38)">
            <animate attributeName="cy" from="42" to="8" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.55;0" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="r" values="3.5;2;3.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="55" cy="24" r="2.8" fill="rgba(29,78,216,0.38)">
            <animate attributeName="cy" from="44" to="6" dur="3.1s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.65;0" dur="3.1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="65" cy="16" r="2.2" fill="rgba(29,78,216,0.32)">
            <animate attributeName="cy" from="46" to="4" dur="2.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.58;0" dur="2.2s" repeatCount="indefinite"/>
        </circle>
        {/* O2 label */}
        <text x="74" y="22" fontSize="8.5" fill="#1D4ED8" fontWeight="700" fontFamily="system-ui, sans-serif">O₂</text>
        {/* Open label */}
        <text x="50" y="136" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="system-ui, sans-serif" letterSpacing="0.08em">EXPOSED</text>
    </svg>
);

// Fermenter SVG para drop zone
const FERMENTER_SVG = (
    <svg viewBox="0 0 120 130" width="90" height="98" aria-hidden="true" className="qz-fermenter-svg">
        <defs>
            <linearGradient id="fermLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d1fae5" />
                <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="fermBody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f0fdf4" />
                <stop offset="100%" stopColor="#dcfce7" />
            </linearGradient>
        </defs>
        {/* Base legs */}
        <rect x="25" y="114" width="10" height="12" rx="3" fill="#9ca3af"/>
        <rect x="85" y="114" width="10" height="12" rx="3" fill="#9ca3af"/>
        {/* Main vessel */}
        <rect x="15" y="28" width="90" height="90" rx="12" fill="url(#fermBody)" stroke="#6ee7b7" strokeWidth="2"/>
        <clipPath id="fermClip">
            <rect x="21" y="68" width="78" height="46" rx="6"/>
        </clipPath>
        {/* Liquid body */}
        <rect x="21" y="68" width="78" height="46" rx="6" fill="url(#fermLiquid)" opacity="0.65"/>
        {/* Animated wavy liquid surface */}
        <g clipPath="url(#fermClip)">
            <path fill="url(#fermLiquid)" opacity="0.5">
                <animate attributeName="d"
                    values="
                        M 21 72 Q 40 67, 60 72 Q 80 77, 99 72 L 99 114 L 21 114 Z;
                        M 21 72 Q 40 77, 60 72 Q 80 67, 99 72 L 99 114 L 21 114 Z;
                        M 21 72 Q 40 67, 60 72 Q 80 77, 99 72 L 99 114 L 21 114 Z"
                    dur="4s" repeatCount="indefinite"/>
            </path>
            {/* Bubbles rising inside fermenter */}
            <circle cx="38" r="2" fill="rgba(255,255,255,0.75)">
                <animate attributeName="cy" values="112;70" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.85;0" dur="3s" repeatCount="indefinite"/>
            </circle>
            <circle cx="60" r="2.4" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="114;68" dur="2.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.9;0" dur="2.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="80" r="1.8" fill="rgba(255,255,255,0.7)">
                <animate attributeName="cy" values="113;70" dur="3.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.8;0" dur="3.5s" repeatCount="indefinite"/>
            </circle>
        </g>
        {/* Top flange */}
        <rect x="10" y="20" width="100" height="12" rx="6" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.5"/>
        {/* Lid entry port */}
        <rect x="42" y="10" width="36" height="14" rx="5" fill="#6ee7b7" stroke="#34d399" strokeWidth="1.5"/>
        <circle cx="60" cy="17" r="4" fill="#10B981"/>
        {/* Question mark inside */}
        <text x="60" y="80" textAnchor="middle" fontSize="28" fill="rgba(16,185,129,0.25)" fontWeight="900" fontFamily="system-ui, sans-serif">?</text>
        {/* Valve on side */}
        <rect x="105" y="55" width="10" height="18" rx="3" fill="#9ca3af" stroke="#6b7280" strokeWidth="1"/>
        <circle cx="110" cy="64" r="4" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1"/>
        {/* Measurement lines */}
        <line x1="21" y1="78" x2="26" y2="78" stroke="#10B981" strokeWidth="1" opacity="0.5"/>
        <line x1="21" y1="90" x2="26" y2="90" stroke="#10B981" strokeWidth="1" opacity="0.5"/>
        <line x1="21" y1="102" x2="26" y2="102" stroke="#10B981" strokeWidth="1" opacity="0.5"/>
    </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type TankId = 'closed' | 'open';

interface Tank {
    id: TankId;
    label: string;
    description: string;
    isCorrect: boolean;
    svg: React.ReactNode;
    accentColor: string;
}

interface McOption {
    key: string;
    label: string;
    sub?: string;
    isCorrect: boolean;
}

const TANKS: Tank[] = [
    {
        id: 'closed',
        label: 'Closed Tank',
        description: 'Sealed · No oxygen exchange',
        isCorrect: true,
        svg: CLOSED_TANK_SVG,
        accentColor: '#c1004a',
    },
    {
        id: 'open',
        label: 'Open Tank',
        description: 'Exposed · Oxygen flows freely',
        isCorrect: false,
        svg: OPEN_TANK_SVG,
        accentColor: '#1D4ED8',
    },
];

const Q2_OPTIONS: McOption[] = [
    { key: 'ph3', label: '3.0', sub: 'Too acidic', isCorrect: false },
    { key: 'ph4', label: '4.0', sub: 'Optimal range', isCorrect: true },
    { key: 'ph5', label: '5.0', sub: 'Barely active', isCorrect: false },
];

const Q3_OPTIONS: McOption[] = [
    { key: 'clean', label: 'Clean tea notes', sub: 'Too light', isCorrect: false },
    { key: 'fruity', label: 'Fruit-forward notes', sub: 'Tropical & bold', isCorrect: true },
    { key: 'none', label: 'No change', sub: 'Incorrect', isCorrect: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const CraftLabQuiz: React.FC = () => {
    const navigate = useNavigate();

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [success, setSuccess] = useState(false);

    // Q1 drag & drop state
    const [wrongId, setWrongId] = useState<TankId | null>(null);
    const [isDraggingId, setIsDraggingId] = useState<TankId | null>(null);
    const [isDropZoneOver, setIsDropZoneOver] = useState(false);
    const [keyboardSelected, setKeyboardSelected] = useState<TankId | null>(null);

    // Q2/Q3 multiple choice state
    const [mcWrong, setMcWrong] = useState<string | null>(null);

    // Touch drag refs
    const touchDragIdRef = useRef<TankId | null>(null);
    const touchGhostRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRef = useRef<HTMLDivElement | null>(null);

    // ── Advance or complete ───────────────────────────────────────────────────

    const advanceOrComplete = useCallback(async () => {
        if (currentQuestion < 2) {
            setTimeout(() => {
                setCurrentQuestion((prev) => prev + 1);
                setWrongId(null);
                setMcWrong(null);
                setKeyboardSelected(null);
            }, 500);
        } else {
            setSuccess(true);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#c1004a', '#1D4ED8', '#10B981', '#ffffff'],
            });
            await unlockCraftLab();
            setTimeout(() => navigate('/craftlab-flow/welcome'), 2800);
        }
    }, [currentQuestion, navigate]);

    // ── Q1: Correct/wrong drop ────────────────────────────────────────────────

    const handleCorrectDrop = useCallback(() => {
        advanceOrComplete();
    }, [advanceOrComplete]);

    const handleWrongDrop = useCallback((id: TankId) => {
        setWrongId(id);
        setTimeout(() => setWrongId(null), 600);
    }, []);

    const resolveDrop = useCallback(
        (droppedId: TankId) => {
            const tank = TANKS.find((t) => t.id === droppedId);
            if (!tank) return;
            if (tank.isCorrect) {
                handleCorrectDrop();
            } else {
                handleWrongDrop(droppedId);
            }
        },
        [handleCorrectDrop, handleWrongDrop],
    );

    // ── Q2/Q3: Multiple choice handler ────────────────────────────────────────

    const handleMcAnswer = (optionKey: string, isCorrect: boolean) => {
        if (isCorrect) {
            advanceOrComplete();
        } else {
            setMcWrong(optionKey);
            setTimeout(() => setMcWrong(null), 600);
        }
    };

    // ── HTML5 Drag & Drop (mouse / pointer) ───────────────────────────────────

    const onDragStart = (e: React.DragEvent<HTMLDivElement>, id: TankId) => {
        e.dataTransfer.setData('tankId', id);
        e.dataTransfer.effectAllowed = 'move';
        setIsDraggingId(id);
    };

    const onDragEnd = () => {
        setIsDraggingId(null);
        setIsDropZoneOver(false);
    };

    const onDragOverZone = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDropZoneOver(true);
    };

    const onDragLeaveZone = () => {
        setIsDropZoneOver(false);
    };

    const onDropZone = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDropZoneOver(false);
        setIsDraggingId(null);
        const droppedId = e.dataTransfer.getData('tankId') as TankId;
        resolveDrop(droppedId);
    };

    // ── Touch events (mobile) ─────────────────────────────────────────────────

    const createGhost = (label: string, x: number, y: number) => {
        const ghost = document.createElement('div');
        ghost.className = 'qz-tank-ghost';
        ghost.textContent = label;
        ghost.style.left = `${x - 60}px`;
        ghost.style.top = `${y - 40}px`;
        document.body.appendChild(ghost);
        touchGhostRef.current = ghost;
    };

    const removeGhost = () => {
        if (touchGhostRef.current) {
            touchGhostRef.current.remove();
            touchGhostRef.current = null;
        }
    };

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>, id: TankId) => {
        touchDragIdRef.current = id;
        const touch = e.touches[0];
        const tank = TANKS.find((t) => t.id === id);
        if (tank) createGhost(tank.label, touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touchGhostRef.current) {
            touchGhostRef.current.style.left = `${touch.clientX - 60}px`;
            touchGhostRef.current.style.top = `${touch.clientY - 40}px`;
        }
        const dropZone = dropZoneRef.current;
        if (dropZone) {
            const rect = dropZone.getBoundingClientRect();
            const over =
                touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom;
            setIsDropZoneOver(over);
        }
    };

    const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        removeGhost();
        setIsDropZoneOver(false);
        const touch = e.changedTouches[0];
        const dropZone = dropZoneRef.current;
        const draggedId = touchDragIdRef.current;
        touchDragIdRef.current = null;

        if (!draggedId || !dropZone) return;

        const rect = dropZone.getBoundingClientRect();
        const inside =
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom;

        if (inside) resolveDrop(draggedId);
    };

    // ── Keyboard accessibility ────────────────────────────────────────────────

    const onTankKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: TankId) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setKeyboardSelected((prev) => (prev === id ? null : id));
        }
    };

    const onDropZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.key === 'Enter' || e.key === ' ') && keyboardSelected) {
            e.preventDefault();
            resolveDrop(keyboardSelected);
            setKeyboardSelected(null);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="qz-container">
            {/* Background pattern decorativo */}
            <div className="qz-bg-pattern" aria-hidden="true" />

            {success ? (
                /* ── Success overlay ─────────────────────────────────────────── */
                <div className="qz-success-wrap" role="alert" aria-live="assertive">
                    {/* Sparkles decorativos */}
                    <div className="qz-sparkles" aria-hidden="true">
                        <span className="qz-spark qz-spark--1">✦</span>
                        <span className="qz-spark qz-spark--2">✦</span>
                        <span className="qz-spark qz-spark--3">✦</span>
                        <span className="qz-spark qz-spark--4">✦</span>
                        <span className="qz-spark qz-spark--5">✦</span>
                    </div>

                    <div className="qz-success-check">
                        <CheckCircle size={56} color="#ffffff" strokeWidth={2.2} />
                    </div>

                    <h1 className="qz-success-title">Congratulations!</h1>
                    <p className="qz-success-text">You're now a certified CraftLab Creator.</p>

                    {/* Triple badge row */}
                    <div className="qz-badge-row" aria-label="Unlocked achievements">
                        <div className="qz-badge qz-badge--lab">
                            <Beaker size={13} aria-hidden="true" />
                            <span>Lab Access</span>
                        </div>
                        <div className="qz-badge qz-badge--creator">
                            <Star size={13} aria-hidden="true" />
                            <span>Creator Status</span>
                        </div>
                        <div className="qz-badge qz-badge--unlock">
                            <Lock size={13} aria-hidden="true" />
                            <span>Full Unlock</span>
                        </div>
                    </div>

                    {/* Spinner dots de navegación */}
                    <div className="qz-nav-dots" aria-label="Navigating to your lab...">
                        <span className="qz-dot" />
                        <span className="qz-dot" />
                        <span className="qz-dot" />
                    </div>
                    <p className="qz-nav-hint">Opening your Lab...</p>
                </div>
            ) : (
                <>
                    {/* ── Progress bar de pasos educativos ── */}
                    <div className="qz-progress" role="progressbar" aria-valuenow={3} aria-valuemin={1} aria-valuemax={3} aria-label="Step 3 of 3">
                        <div className="qz-progress-step qz-progress-step--done" aria-label="Basic education completed">
                            <FlaskConical size={11} aria-hidden="true" />
                        </div>
                        <div className="qz-progress-connector qz-progress-connector--done" />
                        <div className="qz-progress-step qz-progress-step--done" aria-label="Technical education completed">
                            <Beaker size={11} aria-hidden="true" />
                        </div>
                        <div className="qz-progress-connector qz-progress-connector--done" />
                        <div className="qz-progress-step qz-progress-step--active" aria-label="Quiz — current step">
                            <Star size={11} aria-hidden="true" />
                        </div>
                    </div>

                    {/* ── Header con drama editorial ────────────────────────── */}
                    <div className="qz-header">
                        <span className="qz-kicker">STEP 3 OF 3 · VALIDATION</span>
                        <h1 className="qz-title">The Final Check</h1>
                        <p className="qz-subtitle">Answer all three questions to unlock your lab.</p>
                    </div>

                    {/* ── Quiz card ────────────────────────────────────────── */}
                    <div className="qz-card fade-in">

                        {/* ── Dots de progreso dentro del card ────────────── */}
                        <div className="qz-q-progress" role="group" aria-label="Question progress">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={[
                                        'qz-q-dot',
                                        i < currentQuestion ? 'done' : '',
                                        i === currentQuestion ? 'active' : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    aria-label={
                                        i < currentQuestion
                                            ? `Question ${i + 1} completed`
                                            : i === currentQuestion
                                            ? `Question ${i + 1} current`
                                            : `Question ${i + 1} pending`
                                    }
                                >
                                    {i < currentQuestion ? <Check size={12} /> : i + 1}
                                </div>
                            ))}
                        </div>

                        {/* ── Q1: Drag & Drop ──────────────────────────────── */}
                        {currentQuestion === 0 && (
                            <div className="qz-q-content" key="q0">
                                <div className="qz-chip" aria-label="Topic: Microorganisms">QUESTION 1 · MICROORGANISMS</div>

                                <p className="qz-question">
                                    Which tank produces anaerobic fermentation?
                                </p>
                                <p className="qz-hint">Drag the correct tank into the fermenter below</p>

                                {keyboardSelected && (
                                    <p className="qz-keyboard-hint" role="status">
                                        <strong>{TANKS.find((t) => t.id === keyboardSelected)?.label}</strong> selected —
                                        press Enter on the fermenter to drop it.
                                    </p>
                                )}

                                {/* ── Draggable tanks ──────────────────────── */}
                                <div className="qz-tanks-row" role="group" aria-label="Fermentation tanks to choose from">
                                    {TANKS.map((tank) => (
                                        <div
                                            key={tank.id}
                                            className={[
                                                'qz-tank',
                                                isDraggingId === tank.id ? 'is-dragging' : '',
                                                wrongId === tank.id ? 'is-wrong' : '',
                                                keyboardSelected === tank.id ? 'is-keyboard-selected' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            style={
                                                keyboardSelected === tank.id
                                                    ? ({ '--tank-accent': tank.accentColor } as React.CSSProperties)
                                                    : undefined
                                            }
                                            draggable
                                            tabIndex={0}
                                            role="button"
                                            aria-grabbed={isDraggingId === tank.id}
                                            aria-label={`${tank.label}: ${tank.description}. Press Enter to select.`}
                                            onDragStart={(e) => onDragStart(e, tank.id)}
                                            onDragEnd={onDragEnd}
                                            onTouchStart={(e) => onTouchStart(e, tank.id)}
                                            onTouchMove={onTouchMove}
                                            onTouchEnd={onTouchEnd}
                                            onKeyDown={(e) => onTankKeyDown(e, tank.id)}
                                        >
                                            <div className="qz-tank-illustration" aria-hidden="true">
                                                {tank.svg}
                                            </div>
                                            <span className="qz-tank-label">{tank.label}</span>
                                            <span className="qz-tank-desc">{tank.description}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Drop zone ────────────────────────────── */}
                                <div
                                    ref={dropZoneRef}
                                    className={['qz-dropzone', isDropZoneOver ? 'is-over' : '']
                                        .filter(Boolean)
                                        .join(' ')}
                                    role="button"
                                    tabIndex={keyboardSelected ? 0 : -1}
                                    aria-dropeffect="move"
                                    aria-label="Fermenter — drop the correct tank here"
                                    onDragOver={onDragOverZone}
                                    onDragLeave={onDragLeaveZone}
                                    onDrop={onDropZone}
                                    onKeyDown={onDropZoneKeyDown}
                                >
                                    {FERMENTER_SVG}
                                    <span className="qz-dropzone-label">
                                        {isDropZoneOver ? 'Release to drop!' : 'Drop the correct tank here'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── Q2: Multiple choice pH ───────────────────────── */}
                        {currentQuestion === 1 && (
                            <div className="qz-q-content" key="q1">
                                <div className="qz-chip" aria-label="Topic: Acidification">QUESTION 2 · ACIDIFICATION</div>

                                <p className="qz-question">
                                    During fermentation, pH drops from ~6.0 to:
                                </p>
                                <p className="qz-hint">Select the correct final pH value.</p>

                                <div className="qz-mc-grid" role="group" aria-label="pH options">
                                    {Q2_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            className={['qz-mc-card', mcWrong === opt.key ? 'is-wrong' : '']
                                                .filter(Boolean)
                                                .join(' ')}
                                            aria-label={`${opt.label}${opt.sub ? ` — ${opt.sub}` : ''}`}
                                            onClick={() => handleMcAnswer(opt.key, opt.isCorrect)}
                                        >
                                            <span className="qz-mc-label">{opt.label}</span>
                                            {opt.sub && <span className="qz-mc-sub">{opt.sub}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Q3: Multiple choice temperature ─────────────── */}
                        {currentQuestion === 2 && (
                            <div className="qz-q-content" key="q2">
                                <div className="qz-chip" aria-label="Topic: Metabolic Routes">QUESTION 3 · METABOLIC ROUTES</div>

                                <p className="qz-question">
                                    Warmer fermentation temperatures typically produce:
                                </p>
                                <p className="qz-hint">Select the correct flavor outcome.</p>

                                <div className="qz-mc-grid" role="group" aria-label="Flavor outcome options">
                                    {Q3_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            className={['qz-mc-card', mcWrong === opt.key ? 'is-wrong' : '']
                                                .filter(Boolean)
                                                .join(' ')}
                                            aria-label={`${opt.label}${opt.sub ? ` — ${opt.sub}` : ''}`}
                                            onClick={() => handleMcAnswer(opt.key, opt.isCorrect)}
                                        >
                                            <span className="qz-mc-label">{opt.label}</span>
                                            {opt.sub && <span className="qz-mc-sub">{opt.sub}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
