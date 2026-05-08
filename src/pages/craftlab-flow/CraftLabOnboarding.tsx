import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Atom, Microscope, FlaskConical } from 'lucide-react';
import { checkCraftLabUnlocked } from '../../lib/user-progress';
import './CraftLabOnboarding.css';

export const CraftLabOnboarding: React.FC = () => {
    const navigate = useNavigate();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [loading, setLoading] = useState(true);

    // Si ya completó el quiz → skip directo a welcome
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const unlocked = await checkCraftLabUnlocked();
                if (unlocked) {
                    navigate('/craftlab-flow/welcome', { replace: true });
                    return;
                }
            } catch (err) {
                console.error('Failed to check CraftLab unlock status:', err);
                // Fallback: localStorage
                if (localStorage.getItem('craftlab_unlocked') === 'true') {
                    navigate('/craftlab-flow/welcome', { replace: true });
                    return;
                }
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [navigate]);

    const handleChoice = (destination: string) => {
        setIsTransitioning(true);
        setTimeout(() => {
            navigate(destination);
        }, 400);
    };

    if (loading) {
        return <div className="cl-onb-loading">Loading…</div>;
    }

    return (
        <div className={`cl-onb-container${isTransitioning ? ' fade-out' : ''}`}>

            {/* ── HERO VIDEO — 200px fijo ── */}
            <div className="cl-onb-hero">
                <video
                    className="cl-onb-hero-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/hero-ferment-poster.jpg"
                    onError={(e) => {
                        (e.currentTarget as HTMLVideoElement).style.display = 'none';
                    }}
                >
                    <source src="/hero-ferment.mp4" type="video/mp4" />
                </video>
                <img
                    className="cl-onb-hero-fallback"
                    src="https://images.unsplash.com/photo-1737914692097-ac2393eefc03?q=80&w=2000&auto=format&fit=crop"
                    alt="Coffee plantation in Colombia — La Palma y El Tucán"
                />
                <div className="cl-onb-hero-overlay" />
                <div className="cl-onb-hero-title">
                    <h1>
                        Welcome to Craft<span>Lab</span>
                    </h1>
                    <p>Fermentation science — in your hands</p>
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div className="cl-onb-content">

                {/* 3 PILARES */}
                <div className="cl-onb-pillars">

                    <div className="cl-onb-pillar">
                        <div className="cl-onb-pillar-icon blue" aria-hidden="true">
                            <Atom size={22} />
                        </div>
                        <div className="cl-onb-pillar-body">
                            <p className="cl-onb-pillar-title">Metabolic Routes</p>
                            <p className="cl-onb-pillar-sub">How temperature and sugar drive flavor complexity.</p>
                        </div>
                    </div>

                    <div className="cl-onb-pillar">
                        <div className="cl-onb-pillar-icon green" aria-hidden="true">
                            <Microscope size={22} />
                        </div>
                        <div className="cl-onb-pillar-body">
                            <p className="cl-onb-pillar-title">Microorganisms</p>
                            <p className="cl-onb-pillar-sub">The yeast and bacteria that sculpt your cup.</p>
                        </div>
                    </div>

                    <div className="cl-onb-pillar">
                        <div className="cl-onb-pillar-icon accent" aria-hidden="true">
                            <FlaskConical size={22} />
                        </div>
                        <div className="cl-onb-pillar-body">
                            <p className="cl-onb-pillar-title">Acidification</p>
                            <p className="cl-onb-pillar-sub">How pH drops from 6.0 to 4.0 to define acidity.</p>
                        </div>
                    </div>

                </div>

                {/* DIAGNÓSTICO */}
                <div className="cl-onb-diagnostic">
                    <p className="cl-onb-diag-question">
                        How much do you know about fermentation?
                    </p>

                    <div className="cl-onb-diag-grid">
                        <button
                            className="cl-onb-diag-btn novice"
                            onClick={() => handleChoice('/craftlab-flow/basic-education')}
                            aria-label="I know nothing — go to basic education"
                        >
                            <span className="cl-onb-diag-btn-label">I know nothing</span>
                            <span className="cl-onb-diag-btn-sub">Start with the basics</span>
                        </button>

                        <button
                            className="cl-onb-diag-btn advanced"
                            onClick={() => handleChoice('/craftlab-flow/tech-education')}
                            aria-label="I know the basics — go to technical education"
                        >
                            <span className="cl-onb-diag-btn-label">I know the basics</span>
                            <span className="cl-onb-diag-btn-sub">Go deeper into the science</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
