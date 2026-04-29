const sizes = {
  sm: { block: 28, gap: 3, fontSize: 14, tagline: 9, plus60: 16 },
  md: { block: 36, gap: 4, fontSize: 18, tagline: 11, plus60: 20 },
  lg: { block: 44, gap: 5, fontSize: 22, tagline: 13, plus60: 26 },
  xl: { block: 56, gap: 6, fontSize: 28, tagline: 16, plus60: 32 },
} as const;

type LogoSize = keyof typeof sizes;

export function LogoAtive({ size = "md" }: { size?: LogoSize }) {
  const s = sizes[size];
  const letters = ["a", "t", "i", "v", "e"];
  const totalWidth = letters.length * s.block + s.block + (letters.length) * s.gap;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end" style={{ gap: s.gap }}>
        {/* Blocos verdes: a t i v e */}
        {letters.map((letter) => (
          <div
            key={letter}
            className="flex items-center justify-center rounded-sm bg-verde-ative"
            style={{
              width: s.block,
              height: s.block,
              fontSize: s.fontSize,
              lineHeight: 1,
            }}
          >
            <span className="font-bold text-white">{letter}</span>
          </div>
        ))}

        {/* Bloco laranja: + */}
        <div
          className="flex items-center justify-center rounded-sm bg-laranja-ative"
          style={{
            width: s.block,
            height: s.block,
            fontSize: s.fontSize,
            lineHeight: 1,
          }}
        >
          <span className="font-bold text-white">+</span>
        </div>

        {/* 60 em laranja */}
        <span
          className="font-bold text-laranja-ative leading-none self-center"
          style={{ fontSize: s.plus60 }}
        >
          60
        </span>
      </div>

      {/* Tagline */}
      <p
        className="text-cinza-texto tracking-wider uppercase mt-1"
        style={{ fontSize: s.tagline, maxWidth: totalWidth }}
      >
        fisioterapia para idosos
      </p>
    </div>
  );
}
