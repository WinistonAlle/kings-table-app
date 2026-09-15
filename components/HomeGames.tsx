'use client';

import DriftWall from './DriftWall';
import { Rotulo, Secao, Titulo, Realce } from './Secao';
import { useTelaPequena } from './useRolagem';

const items = [
  { title: 'Amigos na mesa', position: '0% 0%' },
  { title: 'A próxima mão', position: '50% 0%' },
  { title: 'Tudo pronto para jogar', position: '100% 0%' },
  { title: 'A mesa vista de cima', position: '0% 100%' },
  { title: 'Uma noite para lembrar', position: '50% 100%' },
  { title: 'Fichas e cartas', position: '100% 100%' },
].map(item => ({ ...item, image: '/home-games-atlas.png', href: undefined }));

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
        <DriftWall items={items} columns={pequena ? 3 : 5} tileWidth={pequena ? 160 : 300} tileHeight={pequena ? 108 : 200} gap={18} dim={0.85} fade={0.25} speed={28} tilt={16} turn={-14} parallax={0.6} lift={64} overlayColor="#080808" />
      </div>
    </section>
  );
}
