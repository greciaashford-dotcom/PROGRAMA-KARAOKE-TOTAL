import * as React from 'react';
import { Button, ButtonProps } from './button.js';
import { cn } from '../../lib/utils.js';

export interface Btn09Props extends ButtonProps {
  /** Color del círculo expansivo en hover (por defecto el celeste/turquesa #00C2B5) */
  hoverCircleColor?: string;
}

/**
 * Componente Btn09 (button-hover) adaptado para Katakana Karaoke con el color
 * Celeste / Turquesa Surf (#00C2B5), ondas SVG decorativas en las esquinas
 * y círculo central expansivo en hover (500ms ease-out).
 */
export const Btn09 = React.forwardRef<HTMLButtonElement, Btn09Props>(
  ({ className, children, variant = 'dark', size = 'default', hoverCircleColor, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn('btn-hover-fx', className)}
        style={
          hoverCircleColor
            ? ({ '--btn-ripple-color': hoverCircleColor, ...props.style } as React.CSSProperties)
            : props.style
        }
        {...props}
      >
        {/* Círculo central expansivo en hover con color celeste #00C2B5 */}
        <span className="btn-hover-circle" aria-hidden="true" />

        {/* Onda SVG esquina inferior izquierda */}
        <span className="btn-hover-wave-left" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="btn-hover-svg"
            viewBox="0 0 487 487"
          >
            <path
              fillOpacity=".14"
              fillRule="nonzero"
              fill="#FFF"
              d="M0 .3c67 2.1 134.1 4.3 186.3 37 52.2 32.7 89.6 95.8 112.8 150.6 23.2 54.8 32.3 101.4 61.2 149.9 28.9 48.4 77.7 98.8 126.4 149.2H0V.3z"
            />
          </svg>
        </span>

        {/* Onda SVG esquina superior derecha */}
        <span className="btn-hover-wave-right" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="btn-hover-svg"
            viewBox="0 0 487 487"
          >
            <path
              fillOpacity=".14"
              fillRule="nonzero"
              fill="#FFF"
              d="M487 486.7c-66.1-3.6-132.3-7.3-186.3-37s-95.9-85.3-126.2-137.2c-30.4-51.8-49.3-99.9-76.5-151.4C70.9 109.6 35.6 54.8.3 0H487v486.7z"
            />
          </svg>
        </span>

        {/* Brillo degradado sutil inferior */}
        <span className="btn-hover-sheen" aria-hidden="true" />

        {/* Contenido (icono + texto) por encima de las capas decorativas */}
        <span className="btn-hover-content">{children ?? 'Hover Me !'}</span>
      </Button>
    );
  },
);
Btn09.displayName = 'Btn09';

export default Btn09;
