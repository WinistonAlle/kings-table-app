/* O fundo do site: raios de luz dourada, muito devagar.
 *
 * Adaptado de um componente de fundo em gradiente escuro. Quatro coisas
 * mudaram, e nenhuma é gosto:
 *
 * 1. **A cor.** O original é ciano (`rgb(0,207,255)`), que não tem relação
 *    nenhuma com este produto. Os raios são o ouro da marca, e são a única
 *    cor da página — mesma regra que valeu na revisão de paleta: num sistema
 *    preto e dourado, tudo que não é ouro é cinza.
 *
 * 2. **A textura.** O original puxa um PNG de ruído de um CDN de terceiro.
 *    Um fundo que só aparece se um servidor alheio responder não é um fundo,
 *    é uma dependência. Aqui é `feTurbulence` embutido em data URI: não custa
 *    requisição, não quebra offline e não expira.
 *
 * 3. **A animação.** O original é ESTÁTICO, apesar do nome. Os raios agora
 *    derivam de lado e respiram, com períodos diferentes por camada para
 *    nunca casarem o ciclo — padrão que repete visivelmente lê como papel de
 *    parede, não como luz.
 *
 * 4. **O que se move é `transform` e `opacity`, e só.** Animar `mask-position`
 *    daria o mesmo efeito e obrigaria o navegador a repintar cinco camadas em
 *    tela cheia a cada quadro. Transform e opacidade a placa de vídeo resolve
 *    sozinha, e isto divide tela com um vídeo raspado pela rolagem e uma cena
 *    3D.
 *
 * Ele fica FIXO atrás de tudo (z-index 0, e as seções estão em 10 pelo
 * globals.css). Durante o herói o vídeo cobre a tela inteira, então na prática
 * ele entra em cena a partir da segunda dobra.
 */

/* Ruído em SVG, embutido. Uma oitava só: o suficiente para tirar o liso do
   preto sem virar chuvisco. */
const RUIDO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23r)' opacity='0.5'/%3E%3C/svg%3E";

/* As máscaras vieram do original e são de propósito IRREGULARES: as paradas
   não são espaçadas por igual. É isso que faz os raios parecerem luz passando
   por uma fresta, em vez de listras desenhadas. */
const RAIOS = [
  "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgba(0,0,0,0) 36%, rgb(0,0,0) 55%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 78%, rgba(0,0,0,0) 97%)",
  "linear-gradient(90deg, rgba(0,0,0,0) 11%, rgb(0,0,0) 25%, rgba(0,0,0,0.55) 41%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 78%, rgba(0,0,0,0) 97%)",
  "linear-gradient(90deg, rgba(0,0,0,0) 9%, rgb(0,0,0) 20%, rgba(0,0,0,0.55) 28%, rgba(0,0,0,0.424) 40%, rgb(0,0,0) 48%, rgba(0,0,0,0.267) 54%, rgba(0,0,0,0.13) 78%, rgb(0,0,0) 88%, rgba(0,0,0,0) 97%)",
  "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 17%, rgba(0,0,0,0.55) 26%, rgb(0,0,0) 35%, rgba(0,0,0,0) 47%, rgba(0,0,0,0.13) 69%, rgb(0,0,0) 79%, rgba(0,0,0,0) 97%)",
  "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgba(0,0,0,0.55) 27%, rgb(0,0,0) 42%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 74%, rgb(0,0,0) 82%, rgba(0,0,0,0.47) 88%, rgba(0,0,0,0) 97%)",
];

/* Ouro claro: é LUZ, não superfície. O #c49c5c da logo é a cor do metal; um
   raio precisa do tom que o metal devolve. */
const LUZ = "211, 178, 126";

export function FundoRaios() {
  return (
    <div
      aria-hidden
      className="fundo-raios pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    >
      {/* A base: clareia no canto superior esquerdo e morre para o preto. */}
      <div
        className="absolute inset-0"
        style={{
          /* Começava no `bg3` (#222). O gradiente é FIXO na viewport e clareia
             no canto superior esquerdo — que é exatamente onde o rótulo e o
             título de TODA seção caem. Medido: o fundo atrás do título ficava
             em (50,46,40), seis vezes mais claro que o preto do site, e o
             texto de apoio despencava para 2,5:1 de contraste ali.
             `bg1` levanta o canto o suficiente para o fundo não ser uma chapa,
             sem acender a área onde se lê. */
          background:
            "radial-gradient(100% 100% at 0% 0%, var(--color-bg1) 0%, var(--color-bg0) 100%)",
          maskImage:
            "radial-gradient(125% 100% at 0% 0%, #000 0%, rgba(0,0,0,0.224) 88%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "radial-gradient(125% 100% at 0% 0%, #000 0%, rgba(0,0,0,0.224) 88%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Os raios ficam FORA da camada acima, e isso é o ponto.
          Dentro dela eles herdavam a máscara radial da base — que cai para
          0,22 de alfa a 88% do caminho a partir do canto superior esquerdo,
          ou seja, apaga justamente o lado direito da tela, que é onde eu
          preciso deles fortes. Máscara de pai multiplica com a do filho: as
          duas juntas somavam a quase nada, e o efeito não aparecia em lugar
          nenhum. */}
      {/* O grupo inteiro deriva; cada raio respira no seu tempo.
            A máscara horizontal é o que permite os raios serem FORTES de novo:
            eles quase somem na metade esquerda, que é onde o texto da página
            mora, e chegam inteiros na direita, que é espaço livre. Antes eu
            tinha resolvido o conflito baixando a intensidade no quadro todo —
            e aí o efeito sumiu junto, que foi exatamente a reclamação.
            Máscara em elemento pai multiplica com a de cada filho, então cada
            raio continua com o recorte irregular dele. */}
      <div
        className="fundo-raios__grupo absolute inset-0"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, transparent 49%, rgba(0,0,0,0.16) 60%, rgba(0,0,0,0.6) 75%, #000 89%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, transparent 49%, rgba(0,0,0,0.16) 60%, rgba(0,0,0,0.6) 75%, #000 89%)",
        }}
      >
        {RAIOS.map((mascara, i) => (
          <div
            key={i}
            className="fundo-raios__raio absolute inset-0"
            style={{
              background: `linear-gradient(rgb(${LUZ}) 0%, rgba(${LUZ}, 0) 100%)`,
              maskImage: mascara,
              WebkitMaskImage: mascara,
              transform: "skewX(45deg)",
              animationDelay: `${i * -7}s`,
              animationDuration: `${17 + i * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Grão. Preto liso lê como tela desligada; ruído sutil lê como
          superfície. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${RUIDO}")`,
          backgroundSize: "160px",
          opacity: 0.028,
        }}
      />

      {/* Trama de pontos. No original ela vem a 20% com pontos de branco a 50%,
          o que sobre um preto de verdade vira uma tela de mosquiteiro. Aqui é
          um décimo disso: some de vista e só tira a chapa do fundo. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.28) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          opacity: 0.032,
        }}
      />
    </div>
  );
}
