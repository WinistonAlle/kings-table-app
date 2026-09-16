'use client';

import DriftWall from './DriftWall';
import { Rotulo, Secao, Titulo, Realce } from './Secao';
import { useTelaPequena } from './useRolagem';

const originais = [
  { title: 'Amigos na mesa', position: '0% 0%' },
  { title: 'A próxima mão', position: '50% 0%' },
  { title: 'Tudo pronto para jogar', position: '100% 0%' },
  { title: 'A mesa vista de cima', position: '0% 100%' },
  { title: 'Uma noite para lembrar', position: '50% 100%' },
  { title: 'Fichas e cartas', position: '100% 100%' },
].map(item => ({ ...item, image: '/home-games-atlas.png', size: '300% 200%', href: undefined }));

const novas = [
  'Poker no loft, mesa vinho',
  'Amigos no apartamento, mesa azul',
  'Cartas e fichas no feltro azul',
  'Uma rodada no jardim',
  'A mesa vinho vista de cima',
  'Outra turma, mesa violeta',
  'Uma maleta diferente',
  'A alegria de mostrar a mão',
  'Home game na cobertura',
  'Fichas no feltro vinho',
  'Poker entre amigos na cabana',
  'Mesa turquesa vista de cima',
].map((title, i) => ({
  title,
  image: '/home-games-variedade.png',
  size: '400% 300%',
  position: `${(i % 4) * 100 / 3}% ${Math.floor(i / 4) * 50}%`,
  href: undefined,
}));

const items = novas.flatMap((foto, i) => i < originais.length ? [foto, originais[i]] : [foto]);

export function HomeGames() {
  const pequena = useTelaPequena();
  return (
    <section id="home-games" className="relative py-20">
      <Secao>
        <div className="mx-auto max-w-2xl text-center">
          <Rotulo>É por essas noites</Rotulo>
          <Titulo>A turma de sempre. <Realce>Mais uma mão.</Realce></Titulo>
        </div>
      </Secao>
      <div className="mt-8 h-[480px] lg:h-[660px]">
        <DriftWall items={items} columns={pequena ? 2 : 4} tileWidth={pequena ? 200 : 340} tileHeight={pequena ? 132 : 200} gap={18} dim={0.85} fade={0.25} speed={28} tilt={pequena ? 10 : 16} turn={pequena ? -8 : -14} parallax={0.6} lift={64} overlayColor="#080808" />
      </div>
    </section>
  );
}
