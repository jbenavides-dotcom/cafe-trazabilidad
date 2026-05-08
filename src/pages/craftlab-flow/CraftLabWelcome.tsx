import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, FlaskConical, Star, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ExitConfirmModal } from '../../components/ExitConfirmModal';
import './CraftLabWelcome.css';

interface RoadmapStep {
    n: number;
    title: string;
    sub: string;
    color: string;
    pills?: string[];
    detail: string;
}

const ROADMAP_STEPS: RoadmapStep[] = [
    { n: 1, title: 'Macroprofile',          sub: 'Choose the flavor family of your coffee.',               color: '#c1004a',
        detail: 'The first creative decision. Fermented, washed or natural — each macro family sets the personality of your cup before anything else happens at the mill.' },
    { n: 2, title: 'Flavor Profile',        sub: 'Refine to specific notes: citric, floral, winey.',       color: '#EC4899',
        detail: 'Fine-tune the sensory direction: tropical, floral, citric, winey, chocolate. This narrows the fermentation strategy Katherine will apply downstream.' },
    { n: 3, title: 'Coffee Variety',        sub: 'Geisha, Sidra, Java, Caturra — each unique genetics.',   color: '#10B981',
        detail: 'Genetics shape the ceiling of what the cup can become. Geisha for jasmine/bergamot, Sidra for elegance, Java for structure, Caturra for balance.' },
    { n: 4, title: 'Quantity',              sub: '12.5 / 25 / 37.5 / 50 kg green coffee.',                 color: '#fbbf24',
        detail: 'Choose lot size in green coffee. Larger lots unlock volume pricing; smaller lots give you flexibility to test multiple protocols per harvest.' },
    { n: 5, title: 'Processing Category',   sub: 'Natural · Washed · Honey · Bio-Innovation.',             color: '#1D4ED8',
        detail: 'The high-level processing road. Natural keeps the cherry, washed strips it, honey is in between, and Bio-Innovation is our laboratory-grade fermentation.' },
    { n: 6, title: 'Processing Method',     sub: 'Specific fermentation protocol from Katherine.',         color: '#8B5CF6',
        detail: 'One of 5 Katherine protocols (LPX-500, BIW-200, NO-120, CSP-48, BNX-100) — each with controlled microbiology and pH curves for a target sensory outcome.' },
    { n: 7, title: 'Processing Parameters', sub: 'Fine-tune times, temperatures and drying.',              color: '#c1004a',
        pills: ['Stabilization', 'Cherry Fermentation', 'Mucilage Fermentation', 'Solar Dry', 'Mechanical Dry'],
        detail: 'Precision dials: stabilization hours, fermentation time (cherry or mucilage), solar-dry days, mechanical-dry hours. Small changes here shift the cup dramatically.' },
    { n: 8, title: 'Shipment Timeframe',    sub: 'Select when you want your lot delivered.',               color: '#10B981',
        detail: 'Pick a quarter or choose earliest availability. We schedule milling, hulling and shipping around your window so the coffee arrives roasting-ready.' },
];

export const CraftLabWelcome: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'welcome' | 'roadmap'>('welcome');
    const [showExitModal, setShowExitModal] = useState(false);

    const handleClose = () => {
        setShowExitModal(true);
    };

    const handleConfirmExit = () => {
        navigate('/craftlab');
    };

    const proceedToRoadmap = () => {
        setStep('roadmap');
        window.scrollTo(0, 0);
    };

    const startConfigurator = () => {
        // Clear any previous configuration state
        localStorage.removeItem('craftlab_config');
        navigate('/craftlab-flow/configurator');
    };

    return (
        <>
            {step === 'welcome' ? (
                <div className="clw-hero">
                    <div className="clw-bg-pattern" aria-hidden="true" />

                    <button
                        className="clw-close"
                        onClick={handleClose}
                        aria-label="Exit CraftLab"
                    >
                        <X size={20} />
                    </button>

                    <div className="clw-hero-inner">
                        <div className="clw-sparks" aria-hidden="true">
                            <span className="clw-spark s1">✦</span>
                            <span className="clw-spark s2">✧</span>
                            <span className="clw-spark s3">✦</span>
                            <span className="clw-spark s4">✧</span>
                        </div>

                        <div className="clw-badge">
                            <Check size={14} />
                            Unlocked
                        </div>

                        <h1 className="clw-title">
                            Welcome to Craft<span className="clw-title-accent">Lab</span>
                        </h1>
                        <p className="clw-subtitle">Your coffee creation playground is ready.</p>

                        <div className="clw-perks">
                            <div className="clw-perk">
                                <div className="clw-perk-icon clw-perk-icon--green">
                                    <FlaskConical size={20} />
                                </div>
                                <span>Lab Access</span>
                            </div>
                            <div className="clw-perk">
                                <div className="clw-perk-icon clw-perk-icon--accent">
                                    <Star size={20} />
                                </div>
                                <span>Creator Status</span>
                            </div>
                            <div className="clw-perk">
                                <div className="clw-perk-icon clw-perk-icon--blue">
                                    <Lock size={20} />
                                </div>
                                <span>Full Unlock</span>
                            </div>
                        </div>

                        <Button variant="primary" size="full" onClick={proceedToRoadmap}>
                            Access CraftLab
                        </Button>
                    </div>
                </div>
            ) : (
                /* Step 9.1 Hoja de Ruta */
                <div className="clw-roadmap">
                    <header className="clw-roadmap-header">
                        <div className="clw-header-spacer" aria-hidden="true" />
                        <div className="clw-header-center">
                            <span className="clw-roadmap-kicker">YOUR JOURNEY</span>
                            <h1 className="clw-roadmap-title">8 steps to craft your coffee</h1>
                        </div>
                        <button
                            className="clw-close clw-close--inline"
                            onClick={handleClose}
                            aria-label="Exit CraftLab"
                        >
                            <X size={20} />
                        </button>
                    </header>

                    <main className="clw-steps-grid">
                        {ROADMAP_STEPS.map((roadmapStep) => (
                            <div
                                key={roadmapStep.n}
                                className="clw-step-card"
                            >
                                <div
                                    className="clw-step-badge"
                                    style={{ background: roadmapStep.color }}
                                >
                                    {roadmapStep.n}
                                </div>
                                <div className="clw-step-card-body">
                                    <h3 className="clw-step-title">{roadmapStep.title}</h3>
                                    <p className="clw-step-sub">{roadmapStep.sub}</p>
                                </div>

                                {/* Popup con explicación — solo visible en desktop:hover */}
                                <div
                                    className="clw-step-popup"
                                    role="tooltip"
                                    aria-hidden="true"
                                >
                                    <div
                                        className="clw-step-popup-accent"
                                        style={{ background: roadmapStep.color }}
                                        aria-hidden="true"
                                    />
                                    <span className="clw-step-popup-kicker">Step {roadmapStep.n}</span>
                                    <p className="clw-step-popup-text">{roadmapStep.detail}</p>
                                </div>
                            </div>
                        ))}
                    </main>

                    <footer className="clw-roadmap-footer">
                        <Button variant="primary" size="full" onClick={startConfigurator}>
                            Begin journey →
                        </Button>
                    </footer>
                </div>
            )}

            <ExitConfirmModal
                isOpen={showExitModal}
                onConfirm={handleConfirmExit}
                onCancel={() => setShowExitModal(false)}
                variant="craftlab"
            />
        </>
    );
};
