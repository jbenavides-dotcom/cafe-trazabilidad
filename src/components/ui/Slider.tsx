import React from 'react';
import './Slider.css';

interface SliderProps {
    label: string;
    min: number;
    max: number;
    step?: number;
    value: number | null;
    onChange: (value: number) => void;
    unit?: string;
    hideHeader?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
    label,
    min,
    max,
    step = 1,
    value,
    onChange,
    unit = '',
    hideHeader = false
}) => {
    // Use min as fallback if null
    const displayValue = value !== null ? value : min;

    return (
        <div className="clui-slider-container">
            {!hideHeader && (
                <div className="clui-slider-header">
                    <span className="clui-slider-label">{label}</span>
                    <span className="clui-slider-value">{displayValue}{unit}</span>
                </div>
            )}

            <input
                type="range"
                className="clui-slider-input"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={label}
            />

            <div className="clui-slider-marks">
                <span className="clui-slider-mark">{min}{unit}</span>
                <span className="clui-slider-mark">{max}{unit}</span>
            </div>
        </div>
    );
};
