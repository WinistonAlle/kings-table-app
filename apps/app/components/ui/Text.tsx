import { Text as RNText, type TextProps } from 'react-native';
import { Colors, Fonts, Type } from '@/constants/tokens';

/* Texto do app.
 *
 * A versão antiga pedia família e tamanho separados (`variant="display"
 * size={28}`), o que na prática virou dezenas de tamanhos diferentes espalhados
 * pelas telas: 13, 15, 16, 22, 28, 32… Hierarquia com passo pequeno lê como
 * planilha, não como produto.
 *
 * Aqui o que se pede é o PAPEL do texto. Cada papel já traz família, corpo,
 * entrelinha e entreletra afinados juntos — que é o único jeito de dois textos
 * em telas diferentes parecerem do mesmo produto.
 */

type Papel =
  /** Número que é o assunto da tela: o relógio, o bolo. Serifa, corpo enorme. */
  | 'hero'
  /** Nome de tela, nome de torneio. */
  | 'titulo'
  | 'subtitulo'
  /** Parágrafo e texto de interface. */
  | 'corpo'
  | 'corpoForte'
  /** Texto secundário, legenda. */
  | 'apoio'
  /** Caixa alta gravada. Seção, rótulo de campo. */
  | 'rotulo'
  /** Algarismos: valores, blinds, contagens. */
  | 'numero'
  | 'numeroForte';

type Estilo = { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing: number };

const PAPEIS: Record<Papel, Estilo> = {
  hero:        { fontFamily: Fonts.displayBold,  ...Type.hero },
  titulo:      { fontFamily: Fonts.displaySemi,  ...Type.titulo },
  subtitulo:   { fontFamily: Fonts.displaySemi,  ...Type.subtitulo },
  corpo:       { fontFamily: Fonts.ui,           ...Type.corpo },
  corpoForte:  { fontFamily: Fonts.uiSemiBold,   ...Type.corpo },
  apoio:       { fontFamily: Fonts.ui,           ...Type.apoio },
  rotulo:      { fontFamily: Fonts.uiSemiBold,   ...Type.rotulo },
  numero:      { fontFamily: Fonts.monoMedium,   ...Type.corpo },
  numeroForte: { fontFamily: Fonts.monoBold,     ...Type.subtitulo },
};

interface KTTextProps extends TextProps {
  papel?: Papel;
  color?: string;
  /** Escapatória para um caso específico. Usar pouco: se precisar muito, o
   *  papel que falta deve virar entrada da tabela acima. */
  size?: number;
}

export function KTText({ papel = 'corpo', color, size, style, ...props }: KTTextProps) {
  const base = PAPEIS[papel];
  return (
    <RNText
      style={[
        base,
        papel === 'rotulo' && { textTransform: 'uppercase' as const },
        { color: color ?? Colors.text0 },
        size !== undefined && {
          fontSize: size,
          /* Entrelinha acompanha o corpo, senão texto grande com entrelinha de
             texto pequeno sobrepõe as linhas. */
          lineHeight: Math.round(size * (base.lineHeight / base.fontSize)),
        },
        style,
      ]}
      {...props}
    />
  );
}
