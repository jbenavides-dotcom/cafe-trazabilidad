import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, Check, FlaskConical, Droplets, Sun,
    Flower2, Moon, Leaf, Package,
    Banana, Cherry, Citrus, Apple, Sparkles, Coffee,
    Crown, Sprout, Grape, Gem, Beaker, Hexagon, Waves,
    Hourglass, Thermometer,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/Slider';
import { ExitConfirmModal } from '../../components/ExitConfirmModal';
import { InfoPopover } from '../../components/InfoPopover';
import { supabase } from '../../lib/supabase';
import './CraftLabConfigurator.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigState {
    macro: string | null;
    flavor: string | null;
    variety: string | null;
    quantity: string | null;
    category: string | null;
    process: string | null;
    stabilization: number | null;
    cherryFerm: number | null;
    mucilageFerm: number | null;
    solarDry: number | null;
    mechDry: number | null;
    shipmentWindow: 'q1' | 'q2' | 'q3' | 'q4' | 'earliest' | null;
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

const STEPS = [
    { id: 'sec-macro',    label: 'Macro Profile' },
    { id: 'sec-flavor',   label: 'Flavor Profile' },
    { id: 'sec-variety',  label: 'Coffee Variety' },
    { id: 'sec-quantity', label: 'Quantity' },
    { id: 'sec-category', label: 'Processing Category' },
    { id: 'sec-method',   label: 'Processing Method' },
    { id: 'sec-params',   label: 'Parameters' },
    { id: 'sec-shipment', label: 'Shipment Window' },
] as const;

// ─── Static data ──────────────────────────────────────────────────────────────

const MACRO_PROFILES: { id: string; label: string; desc: string; color: string; gradient: string; Icon: React.ElementType; iconColor: string }[] = [
    {
        id: 'fermented',
        label: 'Fermented',
        desc: 'Bold, fruity, and complex',
        color: '#9b2335',
        gradient: 'linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)',
        Icon: FlaskConical,
        iconColor: '#9b2335',
    },
    {
        id: 'bright',
        label: 'Bright',
        desc: 'Crisp, acidic, and floral',
        color: '#e6a817',
        gradient: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
        Icon: Sun,
        iconColor: '#b45309',
    },
    {
        id: 'classic',
        label: 'Classic',
        desc: 'Balanced, sweet, and comforting',
        color: '#6b5344',
        gradient: 'linear-gradient(135deg, #fef3c7 0%, #d4a373 100%)',
        Icon: Coffee,
        iconColor: '#6b5344',
    },
];

const FLAVOR_PROFILES: Record<
    string,
    { id: string; label: string; color: string; gradient: string; Icon: React.ElementType }[]
> = {
    fermented: [
        { id: 'f1', label: 'Tropical / Spicy / Cacao', color: '#b78a48', gradient: 'linear-gradient(135deg, #fef3c7 0%, #f59e0b 100%)', Icon: Banana },
        { id: 'f2', label: 'Red Fruits / Sweet',       color: '#9b2335', gradient: 'linear-gradient(135deg, #fee2e2 0%, #f87171 100%)', Icon: Cherry },
    ],
    bright: [
        { id: 'b1', label: 'Citrus / Floral / Tea',    color: '#e6a817', gradient: 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)', Icon: Citrus },
        { id: 'b2', label: 'Green Apple / Crisp',      color: '#5c9e3a', gradient: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', Icon: Apple },
    ],
    classic: [
        { id: 'c1', label: 'Balanced / Aromatic',      color: '#6b5344', gradient: 'linear-gradient(135deg, #fef3c7 0%, #d4a373 100%)', Icon: Sparkles },
        { id: 'c2', label: 'Chocolate / Caramel',      color: '#3d2b1f', gradient: 'linear-gradient(135deg, #fef3c7 0%, #92400e 100%)', Icon: Coffee },
    ],
};

// Cycle of 4 gradients for varieties
const VARIETY_GRADIENTS = [
    'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)',
    'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%)',
    'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)',
    'linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)',
];

const VARIETIES: { id: string; label: string; desc: string; Icon: React.ElementType }[] = [
    { id: 'geisha',       label: 'Geisha',              desc: 'Delicate, tea-like, jasmine',                                              Icon: Crown },
    { id: 'sidra',        label: 'Sidra',               desc: 'Complex, tropical, wine-like',                                             Icon: Cherry },
    { id: 'gesha-sidra',  label: 'Gesha / Sidra Blend', desc: 'Best of both worlds',                                                      Icon: Sparkles },
    { id: 'pink-bourbon', label: 'Pink Bourbon',        desc: 'Rare mutation of Bourbon. Floral, tea-like, delicate acidity.',            Icon: Flower2 },
    { id: 'java',         label: 'Java',                desc: 'Indonesian origin, high altitude. Spicy, earthy, with herbal notes.',      Icon: Leaf },
    { id: 'pacamara',     label: 'Pacamara',            desc: 'Cross of Pacas and Maragogype. Large beans, creamy body, citric.',         Icon: Gem },
    { id: 'tabi',         label: 'Tabi',                desc: 'Colombian hybrid. Sweet, balanced, notes of stone fruit.',                 Icon: Apple },
    { id: 'mokka',        label: 'Mokka',               desc: 'Miniature beans from Ethiopian heritage. Chocolate, wine-like.',           Icon: Grape },
    { id: 'caturra',      label: 'Caturra',             desc: 'Brazilian Bourbon mutation. Clean acidity, medium body, classic.',         Icon: Sprout },
    { id: 'tekisik',      label: 'Tekisik',             desc: 'Salvadoran selection. Bright citrus, honey sweetness, refined.',           Icon: Citrus },
];

interface CategoryDef {
    id: string;
    label: string;
    Icon: React.ElementType;
    gradient: string;
    iconColor: string;
}

const CATEGORIES: Record<string, CategoryDef[]> = {
    fermented: [
        { id: 'bio-innovation', label: 'Bio-Innovation', Icon: FlaskConical, gradient: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)', iconColor: '#6b21a8' },
    ],
    bright: [
        { id: 'lactic',  label: 'Lactic',  Icon: Beaker, gradient: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', iconColor: '#9d174d' },
        { id: 'natural', label: 'Natural', Icon: Sun,    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', iconColor: '#b45309' },
    ],
    classic: [
        { id: 'washed', label: 'Washed', Icon: Droplets, gradient: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', iconColor: '#1D4ED8' },
        { id: 'honey',  label: 'Honey',  Icon: Hexagon,  gradient: 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)', iconColor: '#854d0e' },
    ],
};

interface MethodDef {
    id: string;
    label: string;
    Icon: React.ElementType;
    gradient: string;
    iconColor: string;
}

const METHODS: Record<string, MethodDef[]> = {
    'bio-innovation': [
        { id: 'mucilage-ferm', label: 'Mucilage', Icon: Droplets, gradient: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)', iconColor: '#6b21a8' },
        { id: 'cherry-ferm',   label: 'Cherry',   Icon: Cherry,   gradient: 'linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)', iconColor: '#991b1b' },
    ],
    'lactic':  [{ id: 'lactic-std',  label: 'Lactic Standard',  Icon: Beaker,   gradient: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', iconColor: '#9d174d' }],
    'natural': [{ id: 'natural-std', label: 'Natural Standard', Icon: Sun,      gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', iconColor: '#b45309' }],
    'washed':  [{ id: 'washed-std',  label: 'Washed Standard',  Icon: Waves,    gradient: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', iconColor: '#1D4ED8' }],
    'honey':   [{ id: 'honey-std',   label: 'Honey Standard',   Icon: Hexagon,  gradient: 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)', iconColor: '#854d0e' }],
};

const SHIPMENT_QUARTERS = [
    { id: 'q1' as const, label: 'Q1', range: 'Jan – Mar', Icon: Flower2, gradient: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)', iconColor: '#b45309' },
    { id: 'q2' as const, label: 'Q2', range: 'Apr – Jun', Icon: Sun,     gradient: 'linear-gradient(135deg, #fed7aa 0%, #fb923c 100%)', iconColor: '#c2410c' },
    { id: 'q3' as const, label: 'Q3', range: 'Jul – Sep', Icon: Leaf,    gradient: 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%)', iconColor: '#065f46' },
    { id: 'q4' as const, label: 'Q4', range: 'Oct – Dec', Icon: Moon,    gradient: 'linear-gradient(135deg, #ddd6fe 0%, #a78bfa 100%)', iconColor: '#5b21b6' },
];

interface ParamHint {
    min: number;
    label: string;
    text: string;
}

const PARAM_META = [
    { key: 'stabilization' as const, label: 'Stabilization Time',   Icon: Hourglass,     min: 0, max: 200, step: 10, unit: ' hrs',
      iconColor: '#9d174d', gradient: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)',
      hints: [
          { min: 1,   label: 'Short',    text: 'Quick stabilization — preserves clarity and bright acidity.' },
          { min: 48,  label: 'Moderate', text: 'Balanced structure — develops sweetness without losing cup clarity.' },
          { min: 120, label: 'Extended', text: 'Deep complexity — boozy, layered notes from long cherry rest.' },
      ] as ParamHint[] },
    { key: 'cherryFerm'    as const, label: 'Cherry Fermentation',  Icon: Cherry,         min: 0, max: 200, step: 10, unit: ' hrs',
      iconColor: '#991b1b', gradient: 'linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)',
      hints: [
          { min: 1,   label: 'Subtle',   text: 'Fruity hints, clean finish — for bright, tea-like profiles.' },
          { min: 48,  label: 'Defined',  text: 'Tropical fruit-forward with structured body.' },
          { min: 120, label: 'Intense',  text: 'Wine-like, funky, red berry intensity — Katherine\'s signature territory.' },
      ] as ParamHint[] },
    { key: 'mucilageFerm'  as const, label: 'Mucilage Fermentation', Icon: Droplets,      min: 0, max: 200, step: 10, unit: ' hrs',
      iconColor: '#6b21a8', gradient: 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)',
      hints: [
          { min: 1,   label: 'Short',    text: 'Clean cup, natural sweetness — closer to washed character.' },
          { min: 48,  label: 'Balanced', text: 'Stone fruit + caramel — mucilage sugars fully expressed.' },
          { min: 120, label: 'Deep',     text: 'Bio-innovation territory — citric acidity, tropical complexity.' },
      ] as ParamHint[] },
    { key: 'solarDry'      as const, label: 'Solar Dry',             Icon: Sun,           min: 0, max: 100, step: 1,  unit: ' days',
      iconColor: '#b45309', gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      hints: [
          { min: 1,   label: 'Fast',     text: 'Quick dry — risk of uneven drying, use only with mech backup.' },
          { min: 15,  label: 'Standard', text: 'Ideal range at 1,800m — controlled sun drying on raised beds.' },
          { min: 40,  label: 'Slow',     text: 'Extended sun cure — deeper body, complex dried-fruit sweetness.' },
      ] as ParamHint[] },
    { key: 'mechDry'       as const, label: 'Mechanical Dry',        Icon: Thermometer,   min: 0, max: 100, step: 5,  unit: ' hrs',
      iconColor: '#1D4ED8', gradient: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
      hints: [
          { min: 1,   label: 'Light',    text: 'Final moisture balance — protects delicate aromatics.' },
          { min: 30,  label: 'Medium',   text: 'Standard finish — stabilizes moisture to 11% safely.' },
          { min: 60,  label: 'Heavy',    text: 'Use sparingly — can mute volatile notes. Katherine recommends <72h.' },
      ] as ParamHint[] },
];

// Helper: retorna el hint activo según el valor actual
const getActiveHint = (hints: ParamHint[] | undefined, value: number | null): ParamHint | null => {
    if (!hints || value === null || value <= 0) return null;
    const matches = hints.filter(h => value >= h.min);
    return matches.length > 0 ? matches[matches.length - 1] : null;
};

// Helper: color dinámico según el progreso del slider (0..1).
const getProgressColor = (value: number | null, min: number, max: number): string => {
    if (value === null || max <= min) return '#c1004a';
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const stops: Array<[number, [number, number, number]]> = [
        [0.00, [0x1D, 0x4E, 0xD8]], // azul ciencia
        [0.33, [0x10, 0xB9, 0x81]], // verde
        [0.66, [0xF5, 0x9E, 0x0B]], // ámbar
        [1.00, [0xC1, 0x00, 0x4A]], // fucsia brand
    ];
    let i = 0;
    while (i < stops.length - 2 && pct > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    const t = (pct - p0) / (p1 - p0);
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
};

const SECTION_IMAGES: Record<string, string> = {
    'sec-macro':    'https://images.unsplash.com/photo-1750967613671-297f1b63038d?q=80&w=1400&auto=format&fit=crop',
    'sec-flavor':   'https://images.unsplash.com/photo-1586095516671-d085ff58cdd4?q=80&w=1400&auto=format&fit=crop',
    'sec-variety':  'https://images.unsplash.com/photo-1737914692097-ac2393eefc03?q=80&w=1400&auto=format&fit=crop',
    'sec-quantity': 'https://images.unsplash.com/photo-1703646619157-eb553d16d402?q=80&w=1400&auto=format&fit=crop',
    'sec-category': 'https://images.unsplash.com/photo-1722962883780-8806c3ab546b?q=80&w=1400&auto=format&fit=crop',
    'sec-method':   'https://images.unsplash.com/photo-1586095516671-d085ff58cdd4?q=80&w=1400&auto=format&fit=crop',
    'sec-params':   'https://images.unsplash.com/photo-1750967613671-297f1b63038d?q=80&w=1400&auto=format&fit=crop',
    'sec-shipment': 'https://images.unsplash.com/photo-1703646619157-eb553d16d402?q=80&w=1400&auto=format&fit=crop',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayValue(key: keyof ConfigState, config: ConfigState): string | null {
    const v = config[key];
    if (v === null) return null;
    if (key === 'variety') return VARIETIES.find(x => x.id === v)?.label ?? String(v);
    if (key === 'category') {
        for (const cats of Object.values(CATEGORIES)) {
            const found = cats.find(c => c.id === v);
            if (found) return found.label;
        }
        return String(v);
    }
    if (key === 'process') {
        for (const methods of Object.values(METHODS)) {
            const found = methods.find(m => m.id === v);
            if (found) return found.label;
        }
        return String(v);
    }
    if (key === 'stabilization' || key === 'cherryFerm' || key === 'mucilageFerm') return `${v} hrs`;
    if (key === 'solarDry') return `${v} days`;
    if (key === 'mechDry') return `${v} hrs`;
    if (key === 'shipmentWindow') {
        if (v === 'earliest') return 'Earliest availability';
        const q = SHIPMENT_QUARTERS.find(x => x.id === v);
        return q ? `${q.label} (${q.range})` : String(v);
    }
    return String(v);
}

const REVIEW_ROWS: { key: keyof ConfigState; label: string }[] = [
    { key: 'macro',          label: 'Macro Profile' },
    { key: 'flavor',         label: 'Flavor Profile' },
    { key: 'variety',        label: 'Coffee Variety' },
    { key: 'quantity',       label: 'Quantity' },
    { key: 'category',       label: 'Processing Category' },
    { key: 'process',        label: 'Processing Method' },
    { key: 'stabilization',  label: 'Stabilization Time' },
    { key: 'cherryFerm',     label: 'Cherry Fermentation' },
    { key: 'mucilageFerm',   label: 'Mucilage Fermentation' },
    { key: 'solarDry',       label: 'Solar Dry' },
    { key: 'mechDry',        label: 'Mechanical Dry' },
    { key: 'shipmentWindow', label: 'Shipment Window' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const CraftLabConfigurator: React.FC = () => {
    const navigate = useNavigate();

    // Wizard state
    const [currentStep, setCurrentStep] = useState(0);

    // UI state
    const [showExitModal, setShowExitModal]     = useState(false);
    const [agreedToTerms, setAgreedToTerms]     = useState(false);
    const [showReview, setShowReview]           = useState(false);
    const [submitting, setSubmitting]           = useState(false);
    const [demoMode, setDemoMode]               = useState(false);
    const [orderSubmitted, setOrderSubmitted]   = useState(false);

    const [config, setConfig] = useState<ConfigState>({
        macro: null, flavor: null, variety: null, quantity: null,
        category: null, process: null, stabilization: null,
        cherryFerm: null, mucilageFerm: null, solarDry: null, mechDry: null,
        shipmentWindow: null,
    });

    // ── Config updater (preserva lógica de reset de flavor si cambia macro)
    const updateConfig = (key: keyof ConfigState, value: ConfigState[keyof ConfigState]) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'macro' && prev.macro !== value) next.flavor = null;
            return next;
        });
    };

    // ── Wizard navigation ─────────────────────────────────────────────────────

    const isStepComplete = (stepIdx: number): boolean => {
        switch (stepIdx) {
            case 0: return !!config.macro;
            case 1: return !!config.flavor;
            case 2: return !!config.variety;
            case 3: return !!config.quantity;
            case 4: return !!config.category;
            case 5: return !!config.process;
            case 6: {
                if (config.stabilization === null) return false;
                if (config.solarDry === null)       return false;
                if (config.mechDry === null)        return false;
                if (config.process === 'cherry-ferm'   && config.cherryFerm === null)   return false;
                if (config.process === 'mucilage-ferm' && config.mucilageFerm === null) return false;
                return true;
            }
            case 7: return !!config.shipmentWindow;
            default: return false;
        }
    };

    const goNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            setShowReview(true);
        }
    };

    const goBack = () => {
        if (showReview) {
            setShowReview(false);
            return;
        }
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    // ── Imagen del visual panel según step activo
    const currentImage = SECTION_IMAGES[STEPS[currentStep].id] ?? SECTION_IMAGES['sec-macro'];

    // ── Exit
    const confirmExit = () => {
        localStorage.removeItem('craftlab_config');
        navigate('/craftlab');
    };

    // ── Submit con fallback para modo demo (sin Supabase Auth)
    const handleConfirmOrder = async () => {
        if (submitting) return;
        setSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Sin sesión Supabase → modo demo (café-trazabilidad usa Google OAuth propio)
            if (!user) {
                setDemoMode(true);
                setOrderSubmitted(true);
                setSubmitting(false);
                return;
            }

            // Translate IDs → human labels
            const varietyLabel = config.variety
                ? VARIETIES.find(x => x.id === config.variety)?.label ?? config.variety
                : null;
            let categoryLabel: string | null = null;
            if (config.category) {
                for (const cats of Object.values(CATEGORIES)) {
                    const f = cats.find(c => c.id === config.category);
                    if (f) { categoryLabel = f.label; break; }
                }
                categoryLabel = categoryLabel ?? config.category;
            }
            let processLabel: string | null = null;
            if (config.process) {
                for (const methods of Object.values(METHODS)) {
                    const f = methods.find(m => m.id === config.process);
                    if (f) { processLabel = f.label; break; }
                }
                processLabel = processLabel ?? config.process;
            }
            const shipmentLabel = config.shipmentWindow === 'earliest'
                ? 'Earliest availability'
                : config.shipmentWindow
                    ? (SHIPMENT_QUARTERS.find(x => x.id === config.shipmentWindow)?.label ?? config.shipmentWindow)
                    : null;

            const quantityKg = config.quantity
                ? parseInt(String(config.quantity).replace(/\D/g, ''), 10) || null
                : null;

            const { error } = await supabase.from('cl_orders').insert({
                user_id:            user.id,
                macro:              config.macro,
                flavor:             config.flavor,
                variety:            varietyLabel,
                quantity_kg:        quantityKg,
                category:           categoryLabel,
                process:            processLabel,
                stabilization_hrs:  config.stabilization,
                cherry_ferm_hrs:    config.cherryFerm,
                mucilage_ferm_hrs:  config.mucilageFerm,
                solar_dry_days:     config.solarDry,
                mech_dry_hrs:       config.mechDry,
                shipment_window:    shipmentLabel,
                agreed_to_terms:    true,
            });

            if (error) {
                console.error('CL order insert error:', error);
                alert('Could not submit your build. Please try again.');
                setSubmitting(false);
                return;
            }

            localStorage.removeItem('craftlab_config');
            setOrderSubmitted(true);
        } catch (e) {
            console.error('CL order submit exception:', e);
            alert('Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    // ── Params visibles según proceso seleccionado
    const visibleParams = PARAM_META.filter(p => {
        if (p.key === 'cherryFerm')   return config.process === 'cherry-ferm';
        if (p.key === 'mucilageFerm') return config.process === 'mucilage-ferm';
        return true;
    });

    // ── Pantalla de éxito (real o demo)
    if (orderSubmitted) {
        return (
            <div className="cl-config-container">
                <div className="cl-success-screen">
                    <div className="cl-success-icon">
                        <Check size={40} strokeWidth={2.5} color="#ffffff" />
                    </div>
                    <h2 className="cl-success-title">
                        {demoMode ? 'Demo Complete' : 'Order Submitted'}
                    </h2>
                    {demoMode && (
                        <p className="cl-success-demo-note">
                            Demo mode — pedido no se guardó (sin sesión Supabase Auth)
                        </p>
                    )}
                    <p className="cl-success-desc">
                        {demoMode
                            ? 'You completed the full CraftLab wizard. In production, this order would be saved to your profile.'
                            : 'Your custom lot configuration has been received. Katherine will review it and get in touch soon.'}
                    </p>
                    <Button
                        variant="primary"
                        size="full"
                        onClick={() => navigate('/craftlab')}
                    >
                        Back to CraftLab
                    </Button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render principal
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="cl-config-container">

            {/* ──── HEADER ──────────────────────────────────────── */}
            <header className="cl-config-header">
                <img
                    src="https://res.cloudinary.com/dtkwqoadf/image/upload/v1742314508/CL_completo_ly3ecz.png"
                    alt="CraftLab"
                    className="cl-brand-logo-img"
                />
                <div className="cl-config-subtitle">Design your coffee</div>
                <button
                    className="cl-close-btn"
                    onClick={() => setShowExitModal(true)}
                    aria-label="Exit configurator"
                >
                    <X size={20} />
                </button>

                {/* Progress bar — 8 segmentos */}
                <div
                    className="cl-progress-wrap"
                    aria-label={`Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep].label}`}
                >
                    <div className="cl-progress-track">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={[
                                    'cl-progress-seg',
                                    i < currentStep  ? 'done'   : '',
                                    i === currentStep ? 'active' : '',
                                ].filter(Boolean).join(' ')}
                            />
                        ))}
                    </div>
                    <div className="cl-progress-label">
                        {STEPS[currentStep].label} · Step {currentStep + 1} of {STEPS.length}
                    </div>
                </div>
            </header>

            <div className="cl-body">

                {/* ──── VISUAL PANEL (imagen sticky) ─────────────── */}
                <div className="cl-visual-panel">
                    <img
                        key={currentImage}
                        src={currentImage}
                        alt="Coffee visual"
                        className="cl-visual-image"
                    />
                    <div className="cl-visual-gradient" />
                    <div className={`cl-visual-tag${config.macro ? ' has-selection' : ''}`}>
                        {config.macro ? config.macro.toUpperCase() : 'SELECT PROFILE'}
                        {config.flavor ? ` · ${config.flavor}` : ''}
                    </div>
                </div>

                {/* ──── CONTENT PANEL (un step a la vez) ─────────── */}
                <div className="cl-controls-panel">

                    {/* ── Pantalla de revisión final ── */}
                    {showReview ? (
                        <div key="review" className="cl-step-screen config-section">
                            <div className="section-label">REVIEW</div>
                            <h2 className="section-title">
                                Your CraftLab <span className="cl-accent-text">Build</span>
                            </h2>
                            <p className="section-desc">Check all your selections before placing your order.</p>

                            <div className="cl-review-table">
                                {REVIEW_ROWS.map(row => {
                                    const val = displayValue(row.key, config);
                                    return (
                                        <div key={row.key} className="cl-review-row">
                                            <span className="cl-review-label">{row.label}</span>
                                            <span className={`cl-review-value${val === null ? ' empty' : ''}`}>
                                                {val ?? 'Not selected'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <label className="cl-review-terms">
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={e => setAgreedToTerms(e.target.checked)}
                                    aria-required="true"
                                />
                                <span>
                                    I confirm the parameters for my custom lot and agree to the{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                                        terms and conditions
                                    </a>
                                </span>
                            </label>

                            <div className="params-cta">
                                <Button
                                    variant="primary"
                                    size="full"
                                    disabled={!agreedToTerms || submitting}
                                    isLoading={submitting}
                                    onClick={handleConfirmOrder}
                                >
                                    Confirm and Place Order
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* ── Steps 0-7 ── */
                        <div key={currentStep} className="cl-step-screen config-section">

                            {/* STEP 0 — MACRO PROFILE */}
                            {currentStep === 0 && (
                                <>
                                    <div className="section-label">STEP 01 · MACRO PROFILE</div>
                                    <h2 className="section-title">
                                        Macro <span className="cl-accent-text">Profile</span>
                                        <InfoPopover title="Macro Profile">
                                            A macroprofile is the overall character of your coffee. Fermented leans into funky, complex notes. Bright leans into acidity and clarity. Classic leans into body and balance.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">Choose the flavor direction that defines your lot.</p>
                                    <div className="cl-choices-list">
                                        {MACRO_PROFILES.map(m => (
                                            <div
                                                key={m.id}
                                                className={`cl-choice${config.macro === m.id ? ' selected' : ''}`}
                                                onClick={() => updateConfig('macro', m.id)}
                                                role="radio"
                                                aria-checked={config.macro === m.id}
                                                tabIndex={0}
                                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') ? updateConfig('macro', m.id) : undefined}
                                            >
                                                <div className="cl-choice-icon" style={{ background: m.gradient }}>
                                                    <m.Icon size={22} strokeWidth={1.75} color={m.iconColor} />
                                                </div>
                                                <div className="cl-choice-content">
                                                    <div className="cl-choice-title">{m.label}</div>
                                                    <div className="cl-choice-desc">{m.desc}</div>
                                                </div>
                                                {config.macro === m.id && (
                                                    <div className="cl-choice-check"><Check size={14} /></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* STEP 1 — FLAVOR PROFILE */}
                            {currentStep === 1 && (
                                <>
                                    <div className="section-label">STEP 02 · FLAVOR PROFILE</div>
                                    <h2 className="section-title">
                                        Flavor <span className="cl-accent-text">Profile</span>
                                        <InfoPopover title="Flavor Profile">
                                            Within each macroprofile, flavor profiles define specific note families — like tropical fruits, citrus or cocoa — that your fermentation will amplify.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">Select the specific tasting notes for your coffee.</p>
                                    <div className="cl-choices-list">
                                        {(config.macro ? FLAVOR_PROFILES[config.macro] : []).map(f => {
                                            const { Icon } = f;
                                            return (
                                                <div
                                                    key={f.id}
                                                    className={`cl-choice${config.flavor === f.label ? ' selected' : ''}`}
                                                    onClick={() => updateConfig('flavor', f.label)}
                                                    role="radio"
                                                    aria-checked={config.flavor === f.label}
                                                    tabIndex={0}
                                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') ? updateConfig('flavor', f.label) : undefined}
                                                >
                                                    <div
                                                        className="cl-choice-icon cl-choice-icon--flavor"
                                                        style={{ background: f.gradient }}
                                                        aria-hidden="true"
                                                    >
                                                        <Icon size={22} color={f.color} />
                                                    </div>
                                                    <div className="cl-choice-content">
                                                        <div className="cl-choice-title">{f.label}</div>
                                                    </div>
                                                    {config.flavor === f.label && (
                                                        <div className="cl-choice-check"><Check size={14} /></div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* STEP 2 — COFFEE VARIETY */}
                            {currentStep === 2 && (
                                <>
                                    <div className="section-label">STEP 03 · COFFEE VARIETY</div>
                                    <h2 className="section-title">
                                        Coffee <span className="cl-accent-text">Variety</span>
                                        <InfoPopover title="Coffee Variety">
                                            The genetic material of your coffee. Each variety has distinct cup potential: Geisha floral, Sidra crystalline, Pink Bourbon tea-like. The variety sets the ceiling; process reveals it.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">Each variety brings its own genetic expression to the cup.</p>
                                    <div className="cl-choices-list cl-choices-grid">
                                        {VARIETIES.map((v, idx) => (
                                            <div
                                                key={v.id}
                                                className={`cl-choice${config.variety === v.id ? ' selected' : ''}`}
                                                onClick={() => updateConfig('variety', v.id)}
                                                role="radio"
                                                aria-checked={config.variety === v.id}
                                                tabIndex={0}
                                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') ? updateConfig('variety', v.id) : undefined}
                                            >
                                                <div
                                                    className="cl-choice-icon cl-choice-icon--sm"
                                                    style={{ background: VARIETY_GRADIENTS[idx % VARIETY_GRADIENTS.length] }}
                                                >
                                                    <v.Icon size={20} strokeWidth={1.75} color="#0A1E3F" />
                                                </div>
                                                <div className="cl-choice-content">
                                                    <div className="cl-choice-title">{v.label}</div>
                                                    <div className="cl-choice-desc">{v.desc}</div>
                                                </div>
                                                {config.variety === v.id && (
                                                    <div className="cl-choice-check"><Check size={14} /></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* STEP 3 — QUANTITY */}
                            {currentStep === 3 && (
                                <>
                                    <div className="section-label">STEP 04 · QUANTITY</div>
                                    <h2 className="section-title">
                                        Select <span className="cl-accent-text">Quantity</span>
                                        <InfoPopover title="Quantity">
                                            7.3 kg of cherries = 1 kg of green coffee. We work in 12.5 kg green lots, allowing small-scale experimentation without committing to a full harvest.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">Each box is 35 kg of green coffee. Max. 500 boxes per season.</p>
                                    <div className="cl-choices-list">
                                        {['35kg', '70kg', '105kg'].map(q => (
                                            <button
                                                key={q}
                                                className={`cl-choice cl-qty-btn${config.quantity === q ? ' selected' : ''}`}
                                                onClick={() => updateConfig('quantity', q)}
                                                aria-pressed={config.quantity === q}
                                            >
                                                <div className="cl-choice-icon" style={{ background: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)' }}>
                                                    <Package size={18} color="#1D4ED8" />
                                                </div>
                                                <div className="cl-choice-content">
                                                    <div className="cl-choice-title">
                                                        {q === '35kg' ? '1 Box · 35 kg' : q === '70kg' ? '2 Boxes · 70 kg' : '3 Boxes · 105 kg'}
                                                    </div>
                                                </div>
                                                {config.quantity === q && (
                                                    <div className="cl-choice-check"><Check size={14} /></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* STEP 4 — PROCESSING CATEGORY */}
                            {currentStep === 4 && (
                                <>
                                    <div className="section-label">STEP 05 · PROCESSING CATEGORY</div>
                                    <h2 className="section-title">
                                        Processing <span className="cl-accent-text">Category</span>
                                        <InfoPopover title="Processing Category">
                                            Natural (dried whole), Washed (pulped and fermented with water), Honey (partial pulp removal), Bio-Innovation (our proprietary protocols). Each category unlocks different flavor architectures.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">The processing route shapes the final character of your coffee.</p>
                                    <div className="cl-choices-list">
                                        {(config.macro ? CATEGORIES[config.macro] ?? [] : []).map(c => (
                                            <div
                                                key={c.id}
                                                className={`cl-choice${config.category === c.id ? ' selected' : ''}`}
                                                onClick={() => updateConfig('category', c.id)}
                                                role="radio"
                                                aria-checked={config.category === c.id}
                                                tabIndex={0}
                                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') ? updateConfig('category', c.id) : undefined}
                                            >
                                                <div className="cl-choice-icon" style={{ background: c.gradient }}>
                                                    <c.Icon size={22} strokeWidth={1.75} color={c.iconColor} />
                                                </div>
                                                <div className="cl-choice-content">
                                                    <div className="cl-choice-title">{c.label}</div>
                                                </div>
                                                {config.category === c.id && (
                                                    <div className="cl-choice-check"><Check size={14} /></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* STEP 5 — PROCESSING METHOD */}
                            {currentStep === 5 && (
                                <>
                                    <div className="section-label">STEP 06 · PROCESSING METHOD</div>
                                    <h2 className="section-title">
                                        Processing <span className="cl-accent-text">Method</span>
                                        <InfoPopover title="Processing Method">
                                            Within each category, methods define microbial environment: Lactic favors lactobacilli, Bio-Washed uses controlled yeasts, pH Clarity stops fermentation at target acidity.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc">Select the specific fermentation technique for this lot.</p>
                                    <div className="cl-choices-list">
                                        {(config.category ? METHODS[config.category] ?? [] : []).map(m => (
                                            <div
                                                key={m.id}
                                                className={`cl-choice${config.process === m.id ? ' selected' : ''}`}
                                                onClick={() => updateConfig('process', m.id)}
                                                role="radio"
                                                aria-checked={config.process === m.id}
                                                tabIndex={0}
                                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') ? updateConfig('process', m.id) : undefined}
                                            >
                                                <div className="cl-choice-icon" style={{ background: m.gradient }}>
                                                    <m.Icon size={22} strokeWidth={1.75} color={m.iconColor} />
                                                </div>
                                                <div className="cl-choice-content">
                                                    <div className="cl-choice-title">{m.label}</div>
                                                </div>
                                                {config.process === m.id && (
                                                    <div className="cl-choice-check"><Check size={14} /></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* STEP 6 — PRECISION PARAMETERS */}
                            {currentStep === 6 && (
                                <>
                                    <div className="section-label cl-label-center">STEP 07 · PRECISION PARAMETERS</div>
                                    <h2 className="section-title cl-title-sm cl-title-center">
                                        Precision <span className="cl-accent-text">Parameters</span>
                                        <InfoPopover title="Fermentation Parameters">
                                            Cherry stabilization, cherry fermentation and mucilage fermentation shape the final cup. Longer fermentations generally add body and complexity; shorter preserve clarity.
                                        </InfoPopover>
                                    </h2>
                                    <p className="section-desc cl-desc-center">Fine-tune the technical parameters for your custom process.</p>
                                    <div className="cl-params-grid">
                                        {visibleParams.map(p => {
                                            const val = config[p.key] as number | null;
                                            const { Icon } = p;
                                            const hint = getActiveHint(p.hints, val);
                                            const progressColor = getProgressColor(val, p.min, p.max);
                                            return (
                                                <div key={p.key} className={`cl-param-card${val !== null ? ' has-value' : ''}`}>
                                                    <div className="cl-param-card-top">
                                                        <div className="cl-param-icon" style={{ background: p.gradient }}>
                                                            <Icon size={18} strokeWidth={1.75} color={p.iconColor} />
                                                        </div>
                                                        <div className="cl-param-title">{p.label}</div>
                                                        <div className="cl-param-val" style={val !== null ? { color: progressColor } : undefined}>
                                                            {val !== null ? `${val}${p.unit}` : '—'}
                                                        </div>
                                                    </div>
                                                    <Slider
                                                        label={p.label}
                                                        min={p.min}
                                                        max={p.max}
                                                        step={p.step}
                                                        value={val}
                                                        onChange={v => updateConfig(p.key, v)}
                                                        unit={p.unit}
                                                        hideHeader
                                                    />
                                                    {hint && (
                                                        <div className="cl-param-hint" style={{ borderColor: p.iconColor + '33' }}>
                                                            <span className="cl-param-hint-label" style={{ background: p.gradient, color: p.iconColor }}>
                                                                {hint.label}
                                                            </span>
                                                            <span className="cl-param-hint-text">{hint.text}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* STEP 7 — SHIPMENT WINDOW */}
                            {currentStep === 7 && (
                                <>
                                    <div className="section-label">STEP 08 · SHIPMENT TIMEFRAME</div>
                                    <h2 className="section-title">
                                        Shipment <span className="cl-accent-text">Window</span>
                                    </h2>
                                    <p className="section-desc">Select your preferred delivery window for this lot.</p>

                                    <div className="cl-shipment-grid">
                                        {SHIPMENT_QUARTERS.map(q => {
                                            const { Icon } = q;
                                            return (
                                                <button
                                                    key={q.id}
                                                    className={`cl-shipment-card${config.shipmentWindow === q.id ? ' selected' : ''}`}
                                                    onClick={() => updateConfig('shipmentWindow', q.id)}
                                                    aria-pressed={config.shipmentWindow === q.id}
                                                    disabled={config.shipmentWindow === 'earliest'}
                                                    style={{ background: config.shipmentWindow === q.id ? q.gradient : undefined }}
                                                >
                                                    <Icon size={22} color={q.iconColor} aria-hidden="true" />
                                                    <span className="cl-sqc-label">{q.label}</span>
                                                    <span className="cl-sqc-range">{q.range}</span>
                                                    {config.shipmentWindow === q.id && (
                                                        <Check size={13} className="cl-sqc-check" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <label className="cl-shipment-earliest">
                                        <input
                                            type="checkbox"
                                            checked={config.shipmentWindow === 'earliest'}
                                            onChange={e => {
                                                updateConfig('shipmentWindow', e.target.checked ? 'earliest' : null);
                                            }}
                                            aria-label="Accept earliest available shipment window"
                                        />
                                        <span className="cl-shipment-earliest-label">
                                            Earliest availability — ship whenever my lot is ready
                                        </span>
                                    </label>
                                </>
                            )}

                        </div>
                    )}

                    {/* ──── STEP FOOTER (Back / counter / Next) ──────── */}
                    {!showReview && (
                        <div className="cl-step-footer">
                            <button
                                className="cl-step-back"
                                onClick={goBack}
                                disabled={currentStep === 0}
                                aria-label="Previous step"
                            >
                                ← Back
                            </button>
                            <span className="cl-step-counter" aria-live="polite">
                                {currentStep + 1} / {STEPS.length}
                            </span>
                            <Button
                                variant="primary"
                                onClick={goNext}
                                disabled={!isStepComplete(currentStep)}
                                aria-label={currentStep === STEPS.length - 1 ? 'Review configuration' : 'Next step'}
                            >
                                {currentStep === STEPS.length - 1 ? 'Review →' : 'Next →'}
                            </Button>
                        </div>
                    )}

                    {/* Footer Back para pantalla review */}
                    {showReview && (
                        <div className="cl-step-footer cl-step-footer--review">
                            <button
                                className="cl-step-back"
                                onClick={goBack}
                                aria-label="Back to last step"
                            >
                                ← Back
                            </button>
                        </div>
                    )}

                </div>{/* END controls panel */}
            </div>{/* END cl-body */}

            {/* ──── EXIT MODAL ────────────────────────────────── */}
            <ExitConfirmModal
                isOpen={showExitModal}
                onConfirm={confirmExit}
                onCancel={() => setShowExitModal(false)}
                message="Your configuration will be lost if you leave now."
                confirmLabel="Yes, leave"
                cancelLabel="Stay here"
                variant="craftlab"
            />

        </div>
    );
};
