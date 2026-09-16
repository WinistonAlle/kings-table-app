import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, G, Line } from 'react-native-svg';
import { Colors, Degrade } from '@/constants/tokens';
import { useEffect, useRef, useId } from 'react';
import { Animated, AccessibilityInfo } from 'react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Anel de progresso do nível.
 *
 * É o ornamento que faz o relógio parecer instrumento e não cronômetro de
 * celular. Três camadas: os ticks de mostrador analógico ao fundo, o trilho
 * apagado, e o arco aceso com degradê de ouro (claro no começo, escuro no fim,
 * como metal curvo pegando luz de um lado só).
 *
 * O arco começa às 12 horas e anda no sentido do relógio, que é a única
 * direção que alguém lê como "tempo passando" sem precisar aprender.
 */
export function Anel({
  tamanho = 240,
  espessura = 3,
  progresso,
  ticks = 60,
  cor,
}: {
  tamanho?: number;
  espessura?: number;
  /** 0 a 1. */
  progresso: number;
  ticks?: number;
  /** Sobrescreve o ouro, para estados de alerta. */
  cor?: string;
}) {
  /* O anel corre bem na borda: o miolo é do conteúdo, e foi por disputar
     espaço com ele que a primeira versão cortava a linha dos blinds. */
  const r = (tamanho - espessura) / 2 - 12;
  const c = tamanho / 2;
  const volta = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progresso));
  const arcoId = `arco-${useId().replace(/:/g, '')}`;
  const animado = useRef(new Animated.Value(p)).current;
  useEffect(() => {
    let cancelado = false;
    let movimento: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduzido => {
      if (cancelado) return;
      movimento = Animated.timing(animado, { toValue: p, duration: reduzido ? 0 : 600, useNativeDriver: false });
      movimento.start();
    });
    return () => { cancelado = true; movimento?.stop(); };
  }, [p, animado]);

  return (
    <Svg width={tamanho} height={tamanho}>
      <Defs>
        <SvgGradient id={arcoId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={Degrade.arco[0]} />
          <Stop offset="0.5" stopColor={Degrade.arco[1]} />
          <Stop offset="1" stopColor={Degrade.arco[2]} />
        </SvgGradient>
      </Defs>

      {/* Mostrador: um tick a cada minuto, os de 5 em 5 mais longos. */}
      <G opacity={0.32}>
        {Array.from({ length: ticks }).map((_, i) => {
          const ang = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          const longo = i % 5 === 0;
          /* Ticks POR FORA do trilho, curtos. Por dentro eles brigavam com o
             relógio; compridos, viravam serrilha. */
          const r1 = r + 6;
          const r2 = r + (longo ? 11 : 8.5);
          return (
            <Line
              key={i}
              x1={c + Math.cos(ang) * r1}
              y1={c + Math.sin(ang) * r1}
              x2={c + Math.cos(ang) * r2}
              y2={c + Math.sin(ang) * r2}
              stroke={longo ? Colors.gold500 : Colors.gold700}
              strokeWidth={longo ? 1.2 : 0.8}
              strokeLinecap="round"
            />
          );
        })}
      </G>

      <Circle cx={c} cy={c} r={r} stroke={Colors.gold800} strokeWidth={espessura} fill="none" />
      <AnimatedCircle
        cx={c}
        cy={c}
        r={r}
        stroke={cor ?? `url(#${arcoId})`}
        strokeWidth={espessura}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${volta} ${volta}`}
        strokeDashoffset={Animated.multiply(Animated.subtract(1, animado), volta)}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}
