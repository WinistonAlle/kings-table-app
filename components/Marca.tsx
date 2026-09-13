/* A marca, embutida como componente.

   Inline e não <img>: assim ela herda a cor de quem a desenha (currentColor),
   escala com a tipografia e não custa uma requisição. O arquivo em
   public/marca/ continua existindo para quem precisar dele solto. */

export function Marca({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1266" className={className} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M495.9 0L401.3 111.4L303.3 35.8L296.3 38.7L299.4 34.6L293.6 30.3L318.5 208.9L680.6 208.9L705.1 30.6L597.7 111.4L509 9.2ZM0 271.8L0 1262.3L3.1 1266.4L996 1266.4L1000 1262.3L1000 274.9L996 271.8ZM949.8 322.2L949.8 1212.8L49.7 1212.8L49.7 327.5L47.8 325.4L51.9 322.2ZM152.1 385.9L152.1 390.7L240.6 472.1L244.9 480.1L364.7 590.9L359.8 592.4L333.8 578.4L138.9 508.4L103 492L103 614.4L224.2 707L271.8 749L102.8 713L102.8 851L423.1 1154.5L622.4 1154.5L624.9 1157.6L628.7 1149.3L386.7 927.6L372.7 904.8L367.2 877.6L384.9 902.8L400.7 908.4L483.8 905.6L519.2 911.2L665.8 1034.2L684.6 1048.2L690.5 1048.2L754.6 990.9L754.6 901.2L750.6 897.2L651.3 894.8L701.9 880.4L751.1 858L772.3 844.1L792.7 820.4L803.6 792.9L803.6 775.6L749.1 719.6L749.5 715.6L830.1 715.6L866.4 711L691.8 563L683.6 514.8L663.2 491.7L511 385.9ZM615.4 546.3L637.1 548L637.1 626L608.9 606.4L551 578.4L511.6 546.3ZM103.5 1063.1L102.7 1153.4L107 1157.6L109.4 1154.5L295.1 1154.5L297.5 1157.6L301.7 1154.1L103.5 972.8Z" />
    </svg>
  );
}

/* A forma reduzida. A marca cheia some abaixo de ~40px: as listras da juba
   fundem e o leão vira mancha. Abaixo disso, é a coroa que carrega a marca. */
export function Coroa({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 508" className={className} aria-hidden="true">
      <path fill="currentColor" d="M491.6 0L261.7 270.7L23.6 87L6.6 94L14.1 84.1L0 73.6L60.5 507.7L940.5 507.7L1000 74.4L739 270.7L523.5 22.4Z" />
    </svg>
  );
}
