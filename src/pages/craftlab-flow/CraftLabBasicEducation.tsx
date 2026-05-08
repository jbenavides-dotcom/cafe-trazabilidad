import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Beaker, Thermometer, Wind, Play } from 'lucide-react';
import { ExitConfirmModal } from '../../components/ExitConfirmModal';
import './CraftLabBasicEducation.css';

interface StorySlide {
    id: number;
    title: string;
    highlight?: string;
    text: string;
    icon: React.ReactNode;
    gradient: string;
    iconColor: string;
}

// Inline SVG: pH curve from ~6.0 → ~4.0 over 110 hours
const PH_CURVE_SVG = (
    <svg
        width="180"
        height="120"
        viewBox="0 0 180 120"
        aria-label="pH curve descending from 6.0 to 4.0 over 110 hours"
        role="img"
    >
        {/* Axes */}
        <line x1="28" y1="10" x2="28" y2="100" stroke="#1E3A5F" strokeWidth="1.5" />
        <line x1="28" y1="100" x2="172" y2="100" stroke="#1E3A5F" strokeWidth="1.5" />

        {/* Y-axis labels (pH) */}
        <text x="4" y="18" fontSize="9" fill="#4A4A4A">6</text>
        <text x="4" y="58" fontSize="9" fill="#4A4A4A">5</text>
        <text x="4" y="98" fontSize="9" fill="#4A4A4A">4</text>

        {/* Y-axis gridlines */}
        <line x1="28" y1="15" x2="172" y2="15" stroke="#ddd" strokeWidth="0.8" strokeDasharray="3,3" />
        <line x1="28" y1="57" x2="172" y2="57" stroke="#ddd" strokeWidth="0.8" strokeDasharray="3,3" />

        {/* X-axis tick labels (hours) */}
        <text x="26"  y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">0</text>
        <text x="54"  y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">24</text>
        <text x="82"  y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">48</text>
        <text x="110" y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">72</text>
        <text x="138" y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">96</text>
        <text x="166" y="112" fontSize="8" fill="#4A4A4A" textAnchor="middle">110</text>

        {/* Axis labels */}
        <text x="100" y="120" fontSize="8" fill="#888" textAnchor="middle">hours</text>
        <text x="10" y="60" fontSize="8" fill="#888" textAnchor="middle" transform="rotate(-90,10,60)">pH</text>

        {/* pH curve */}
        <path
            d="M 28,15 C 55,16 62,30 82,45 S 120,80 166,96"
            fill="none"
            stroke="#E85A7A"
            strokeWidth="2.5"
            strokeLinecap="round"
        />

        {/* Start / end data points */}
        <circle cx="28"  cy="15" r="3.5" fill="#E85A7A" />
        <circle cx="166" cy="96" r="3.5" fill="#E85A7A" />

        {/* Annotations */}
        <text x="32"  y="13" fontSize="8" fill="#E85A7A" fontWeight="bold">pH 6.0</text>
        <text x="120" y="110" fontSize="8" fill="#E85A7A" fontWeight="bold">pH 4.0</text>
    </svg>
);

const slides: StorySlide[] = [
    {
        id: 1,
        title: "It's a Process",
        highlight: "Process",
        text: "Fermentation transforms raw cherries into the beans that define your coffee's character. It's where science meets craft.",
        icon: <Beaker size={64} />,
        gradient: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)',
        iconColor: '#9d174d',
    },
    {
        id: 2,
        title: "Metabolic Routes",
        highlight: "Metabolic",
        text: "Temperature and Brix (sugar content) act as the steering wheel. Warmer temps speed up the process, bringing out intense fruit notes.",
        icon: <Thermometer size={64} />,
        gradient: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
        iconColor: '#92400e',
    },
    {
        id: 3,
        title: "Oxygen Matters",
        highlight: "Oxygen",
        text: "An open tank (Aerobic) yields clean, smooth notes. A closed tank (Anaerobic) creates pressure and intense, boozy, tropical flavors.",
        icon: <Wind size={64} />,
        gradient: 'linear-gradient(135deg, #dbeafe 0%, #60a5fa 100%)',
        iconColor: '#1e40af',
    },
    {
        id: 4,
        title: "Seeing it in Action",
        highlight: "Action",
        text: "At our farm, cherries are floated, sorted, and placed into dedicated tanks where the magic begins.",
        icon: <Play size={64} />,
        gradient: 'linear-gradient(135deg, #ede9fe 0%, #a78bfa 100%)',
        iconColor: '#5b21b6',
    },
    {
        id: 5,
        title: "Acidification",
        highlight: "Acidification",
        text: "As fermentation progresses, lactobacilli and yeasts produce organic acids. pH drops from ~6.0 to ~4.0 over 110 hours — this curve determines whether your coffee tastes bright, balanced or fermented.",
        icon: PH_CURVE_SVG,
        gradient: 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%)',
        iconColor: '#065f46',
    },
];

// Duration for auto-advance per slide (in ms)
const SLIDE_DURATION = 8000;

export const CraftLabBasicEducation: React.FC = () => {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [showExitModal, setShowExitModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (showExitModal) return;

        let animationFrameId: number;
        const startTime = Date.now();

        const animateProgress = () => {
            const elapsed = Date.now() - startTime;
            const percentage = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
            setProgress(percentage);

            if (percentage < 100) {
                animationFrameId = requestAnimationFrame(animateProgress);
            } else {
                setCurrentSlideIndex((prev) => {
                    if (prev < slides.length - 1) {
                        return prev + 1;
                    }
                    return prev;
                });
                setProgress(0);
                if (currentSlideIndex >= slides.length - 1) {
                    navigate('/craftlab-flow/quiz');
                }
            }
        };

        animationFrameId = requestAnimationFrame(animateProgress);
        return () => cancelAnimationFrame(animationFrameId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSlideIndex, showExitModal]);

    const handleNext = () => {
        if (currentSlideIndex < slides.length - 1) {
            setCurrentSlideIndex(prev => prev + 1);
            setProgress(0);
        } else {
            navigate('/craftlab-flow/quiz');
        }
    };

    const handlePrev = () => {
        if (currentSlideIndex > 0) {
            setCurrentSlideIndex(prev => prev - 1);
            setProgress(0);
        }
    };

    const currentSlide = slides[currentSlideIndex];

    return (
        <div className="education-stories-container">

            {/* Progress Bars */}
            <div className="stories-progress-container">
                {slides.map((slide, index) => (
                    <div key={slide.id} className="story-progress-segment">
                        <div
                            className={`story-progress-fill ${index < currentSlideIndex ? 'completed' : ''}`}
                            style={{ width: index === currentSlideIndex ? `${progress}%` : undefined }}
                        />
                    </div>
                ))}
            </div>

            <button
                className="story-close"
                onClick={() => setShowExitModal(true)}
                aria-label="Exit education"
            >
                <X size={28} />
            </button>

            {/* Invisible Tap Zones */}
            <div className="story-tap-zones">
                <div className="tap-zone-left" onClick={handlePrev}></div>
                <div className="tap-zone-right" onClick={handleNext}></div>
            </div>

            {/* Content */}
            <div className="be-content">
                <div
                    className="be-icon-circle"
                    style={{ background: currentSlide.gradient, color: currentSlide.iconColor }}
                >
                    {currentSlide.icon}
                </div>
                <div className="be-text-wrap">
                    <h2 className="be-title">
                        {currentSlide.highlight ? (
                            <>
                                {currentSlide.title.split(currentSlide.highlight)[0]}
                                <span className="be-title-accent">{currentSlide.highlight}</span>
                                {currentSlide.title.split(currentSlide.highlight)[1]}
                            </>
                        ) : (
                            currentSlide.title
                        )}
                    </h2>
                    <p className="be-text">{currentSlide.text}</p>
                </div>
            </div>

            <ExitConfirmModal
                isOpen={showExitModal}
                onConfirm={() => { navigate('/craftlab-flow/onboarding'); }}
                onCancel={() => setShowExitModal(false)}
                variant="craftlab"
            />

        </div>
    );
};
