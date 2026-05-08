import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Dna, Activity, FlaskConical, Unlock } from 'lucide-react';
import { ExitConfirmModal } from '../../components/ExitConfirmModal';
import './CraftLabTechEducation.css';

type HotspotId = 'microbes' | 'routes' | 'ph' | null;

/* ── Tank SVG minimal ── */
const TANK_SVG = (
    <svg viewBox="0 0 320 220" className="te-tank-svg" aria-hidden="true">
        <defs>
            <linearGradient id="tankLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
        </defs>
        {/* Tank outline */}
        <rect x="60" y="30" width="200" height="160" rx="24" ry="24" fill="#ffffff" stroke="#d1d5db" strokeWidth="2" />
        {/* Liquid */}
        <rect x="68" y="70" width="184" height="112" rx="16" ry="16" fill="url(#tankLiquid)" opacity="0.5" />
        {/* Bubbles */}
        <circle cx="110" cy="150" r="4" fill="rgba(255,255,255,0.6)">
            <animate attributeName="cy" from="170" to="90" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0" to="0" values="0;0.8;0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="160" cy="140" r="3" fill="rgba(255,255,255,0.5)">
            <animate attributeName="cy" from="175" to="85" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0" to="0" values="0;0.8;0" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="160" r="5" fill="rgba(255,255,255,0.55)">
            <animate attributeName="cy" from="180" to="80" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0" to="0" values="0;0.8;0" dur="3.5s" repeatCount="indefinite" />
        </circle>
        {/* Label BIO-TANK A1 */}
        <text
            x="160"
            y="52"
            fontSize="11"
            fontWeight="700"
            fill="#0A1E3F"
            textAnchor="middle"
            letterSpacing="3"
        >
            BIO-TANK A1
        </text>
    </svg>
);

export const CraftLabTechEducation: React.FC = () => {
    const navigate = useNavigate();
    const [activeSpot, setActiveSpot] = useState<HotspotId>(null);
    const [readSpots, setReadSpots] = useState<Set<HotspotId>>(new Set());
    const [showExitModal, setShowExitModal] = useState(false);

    const handleSpotClick = (id: HotspotId) => {
        setActiveSpot(id);
        setReadSpots(prev => new Set(prev).add(id));
    };

    const isUnlocked = readSpots.size === 3;

    const getSpotContent = () => {
        switch (activeSpot) {
            case 'microbes':
                return (
                    <div key="microbes" className="te-info-card">
                        <h3 className="te-info-title">
                            <span className="te-info-icon green"><FlaskConical size={18} /></span>
                            Microorganisms
                        </h3>
                        <p className="te-info-body">
                            We focus on cultivating indigenous strains like <em>Lactobacillus plantarum</em> and{' '}
                            <em>Saccharomyces cerevisiae</em>. These specific cultures are selected for their ability
                            to outcompete spoilage microbes and produce highly desirable ester compounds during anaerobic fermentation.
                        </p>
                    </div>
                );
            case 'routes':
                return (
                    <div key="routes" className="te-info-card">
                        <h3 className="te-info-title">
                            <span className="te-info-icon blue"><Dna size={18} /></span>
                            Metabolic Routes
                        </h3>
                        <p className="te-info-body">
                            By completely removing oxygen (Anaerobic), yeast and bacteria are forced into alternative
                            catabolic pathways. This stress response synthesizes complex organic acids (like lactic and acetic acid)
                            that translate into vibrant tropical and boozy notes in the cup.
                        </p>
                    </div>
                );
            case 'ph':
                return (
                    <div key="ph" className="te-info-card">
                        <h3 className="te-info-title">
                            <span className="te-info-icon accent"><Activity size={18} /></span>
                            Acidification &amp; pH
                        </h3>
                        <p className="te-info-body">
                            Monitoring the pH drop is critical. Over a 110-hour Bio-Innovation fermentation, we track
                            the pH as it drops from ~5.5 to ~3.8. This controlled acidification ensures a crisp,
                            tartaric-like acidity that makes the coffee refreshing rather than overwhelmingly heavy.
                        </p>
                    </div>
                );
            default:
                return (
                    <div key="placeholder" className="te-info-card">
                        <p className="te-info-placeholder">Tap a glowing point on the tank to explore the science.</p>
                    </div>
                );
        }
    };

    return (
        <>
            <div className="te-container">

                {/* Header */}
                <header className="te-header">
                    <div className="te-header-copy">
                        <h1 className="te-title">Technical Explorer</h1>
                        <p className="te-subtitle">Tap 3 points to unlock the quiz</p>
                    </div>
                    <button
                        className="te-close"
                        onClick={() => setShowExitModal(true)}
                        aria-label="Exit technical education"
                    >
                        <X size={18} />
                    </button>
                </header>

                {/* Body: diagrama + panel info */}
                <div className="te-body">

                    {/* Diagrama del tanque */}
                    <div className="te-diagram" role="img" aria-label="Fermentation tank with 3 interactive points">
                        {TANK_SVG}

                        <button
                            className={[
                                'te-hotspot',
                                'te-hotspot-microbes',
                                readSpots.has('microbes') ? 'read' : '',
                                activeSpot === 'microbes' ? 'active' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleSpotClick('microbes')}
                            aria-label="Explore Microorganisms"
                            aria-pressed={activeSpot === 'microbes'}
                        >
                            <FlaskConical size={18} />
                        </button>

                        <button
                            className={[
                                'te-hotspot',
                                'te-hotspot-routes',
                                readSpots.has('routes') ? 'read' : '',
                                activeSpot === 'routes' ? 'active' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleSpotClick('routes')}
                            aria-label="Explore Metabolic Routes"
                            aria-pressed={activeSpot === 'routes'}
                        >
                            <Dna size={18} />
                        </button>

                        <button
                            className={[
                                'te-hotspot',
                                'te-hotspot-ph',
                                readSpots.has('ph') ? 'read' : '',
                                activeSpot === 'ph' ? 'active' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleSpotClick('ph')}
                            aria-label="Explore Acidification and pH"
                            aria-pressed={activeSpot === 'ph'}
                        >
                            <Activity size={18} />
                        </button>
                    </div>

                    {/* Panel de información */}
                    <div className="te-body-right">
                        {getSpotContent()}
                    </div>

                </div>

                {/* Progress indicator */}
                <div className="te-progress" role="status" aria-label={`${readSpots.size} of 3 points explored`}>
                    <p className="te-progress-label">{readSpots.size} of 3 explored</p>
                    <div className="te-progress-bar" aria-hidden="true">
                        <div className={`te-progress-seg ${readSpots.size >= 1 ? 'on' : ''}`} />
                        <div className={`te-progress-seg ${readSpots.size >= 2 ? 'on' : ''}`} />
                        <div className={`te-progress-seg ${readSpots.size >= 3 ? 'on' : ''}`} />
                    </div>
                </div>

                {/* Footer sticky */}
                <footer className="te-footer">
                    <button
                        className={`te-unlock-btn ${isUnlocked ? 'unlocked' : ''}`}
                        disabled={!isUnlocked}
                        onClick={() => navigate('/craftlab-flow/quiz')}
                        aria-disabled={!isUnlocked}
                    >
                        {isUnlocked
                            ? <>Proceed to Validation <Unlock size={16} /></>
                            : 'Explore all points to unlock'
                        }
                    </button>
                </footer>

            </div>

            <ExitConfirmModal
                isOpen={showExitModal}
                onConfirm={() => { navigate('/craftlab-flow/onboarding'); }}
                onCancel={() => setShowExitModal(false)}
                variant="craftlab"
            />
        </>
    );
};
