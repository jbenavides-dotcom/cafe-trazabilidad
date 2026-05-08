import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'full';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading,
    className = '',
    disabled,
    ...props
}) => {
    const baseClasses = 'clui-btn';
    const variantClasses = `clui-btn-${variant}`;
    const sizeClasses = `clui-btn-${size}`;
    const loadingClass = isLoading ? 'clui-btn-loading' : '';

    return (
        <button
            className={`${baseClasses} ${variantClasses} ${sizeClasses} ${loadingClass} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="clui-spinner"></span>
            ) : null}
            <span className="clui-btn-content">{children}</span>
        </button>
    );
};
