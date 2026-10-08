import React from 'react';
import { Delete, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface TailorKeypadProps {
  currentFieldLabel: string;
  currentValue: string;
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onNext: () => void;
  onClose?: () => void;
}

export const TailorKeypad: React.FC<TailorKeypadProps> = ({
  currentFieldLabel,
  currentValue,
  onKeyPress,
  onBackspace,
  onClear,
  onNext,
  onClose
}) => {
  const { t, isRtl } = useLanguage();

  return (
    <div className="bg-[#092623] text-white rounded-t-3xl shadow-2xl border-t border-teal-800/80 p-3.5 select-none touch-manipulation animate-in slide-in-from-bottom-5 duration-200">
      {/* Target Field Indicator */}
      <div className="flex items-center justify-between px-2 pb-2.5 mb-2.5 border-b border-teal-900/80">
        <div className="flex items-center gap-2">
          <span className="text-xs text-teal-400 font-medium">{t.detailSection}:</span>
          <span className="text-sm font-bold text-amber-100">{currentFieldLabel || t.measurements}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-mono font-bold text-amber-300 px-3.5 py-0.5 bg-[#0e3b37] border border-teal-700/60 rounded-lg min-w-[65px] text-center shadow-inner">
            {currentValue || '0'}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-teal-300 hover:text-white px-2.5 py-1 bg-[#0e3b37] border border-teal-800 rounded-lg cursor-pointer"
            >
              {t.close}
            </button>
          )}
        </div>
      </div>

      {/* Grid of keys: 4 columns x 4 rows */}
      <div className="grid grid-cols-4 gap-2">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => onKeyPress('7')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('8')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('9')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          9
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className="h-12 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/40 text-rose-300 rounded-xl transition-colors flex items-center justify-center shadow-sm cursor-pointer"
          title="Backspace"
        >
          <Delete className="w-5 h-5" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => onKeyPress('4')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('5')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('6')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          6
        </button>
        {/* Fraction 1/4 -> .25 */}
        <button
          type="button"
          onClick={() => onKeyPress('.25')}
          className="h-12 bg-[#164843] hover:bg-[#206059] active:bg-amber-600 text-amber-300 font-bold rounded-xl text-base transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          ¼
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => onKeyPress('1')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('2')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('3')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          3
        </button>
        {/* Fraction 1/2 -> .5 */}
        <button
          type="button"
          onClick={() => onKeyPress('.5')}
          className="h-12 bg-[#164843] hover:bg-[#206059] active:bg-amber-600 text-amber-300 font-bold rounded-xl text-base transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          ½
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => onKeyPress('0')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onKeyPress('.')}
          className="h-12 bg-[#103e39] hover:bg-[#18534d] active:bg-teal-600 rounded-xl text-2xl font-bold font-mono transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          .
        </button>
        {/* Fraction 3/4 -> .75 */}
        <button
          type="button"
          onClick={() => onKeyPress('.75')}
          className="h-12 bg-[#164843] hover:bg-[#206059] active:bg-amber-600 text-amber-300 font-bold rounded-xl text-base transition-colors flex items-center justify-center shadow-sm cursor-pointer"
        >
          ¾
        </button>
        {/* Next Button (Teal) */}
        <button
          type="button"
          onClick={onNext}
          className="h-12 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-1 shadow-md shadow-teal-950/40 cursor-pointer"
        >
          <span>{t.next}</span>
          <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
