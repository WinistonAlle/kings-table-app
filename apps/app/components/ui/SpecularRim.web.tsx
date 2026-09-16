import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

// React Bits SpecularButton: mesmo SDF, com um renderer compartilhado entre botoes.
const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 uHalfSize;
uniform vec2 uCenter;
uniform float uAngle;
uniform float uBright;
uniform float uDpr;
uniform vec3 uColor;
out vec4 fragColor;
void main(){
 vec2 p=gl_FragCoord.xy-uCenter;
 float r=min(8.*uDpr,min(uHalfSize.x,uHalfSize.y));
 vec2 q=abs(p)-uHalfSize+r;
 float d=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
 vec2 n=normalize(p/(uHalfSize*uHalfSize)+1e-6);
 float phi=acos(clamp(abs(dot(n,vec2(cos(uAngle),sin(uAngle)))),0.,1.));
 float rim=1.-smoothstep(-.52,.87,phi);
 float hi=exp(-pow(d/(1.1*uDpr),2.))*rim*uBright*.6;
 float base=(1.-smoothstep(0.,uDpr,abs(d)))*.28;
 float glow=exp(-pow(d/(3.*uDpr),2.))*rim*uBright*.12;
 fragColor=vec4(uColor*(hi+glow+base*.6),clamp(base+hi+glow,0.,1.));
}`;

type Entry = { canvas: HTMLCanvasElement; host: HTMLElement; context: CanvasRenderingContext2D; danger: boolean; angle: number; target: number; bright: number; targetBright: number };
const entries = new Set<Entry>();
let renderer: Renderer | undefined;
let mesh: Mesh | undefined;
let program: Program | undefined;
let frame = 0;
let last = 0;
let pointer: { x: number; y: number } | null = null;
const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function targets() {
  for (const e of entries) {
    const rect = e.host.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    const focus = e.host.contains(document.activeElement);
    const distance = pointer ? Math.hypot(Math.max(rect.left-pointer.x,0,pointer.x-rect.right),Math.max(rect.top-pointer.y,0,pointer.y-rect.bottom)) : Infinity;
    const t = Math.max(0,1-distance/200);
    e.targetBright = visible ? focus ? 1 : reduced() ? .35 : t*t*(3-2*t) : 0;
    e.target = pointer && !reduced() ? Math.atan2(rect.top+rect.height/2-pointer.y,pointer.x-rect.left-rect.width/2) : 2.4;
  }
  if (!frame) { last = performance.now(); frame = requestAnimationFrame(paint); }
}

function paint(now: number) {
  frame = 0;
  if (!renderer || !program || !mesh) return;
  const dt = Math.min((now-last)/1000,.05);
  last = now;
  let moving = false;
  const instant = reduced();
  for (const e of entries) {
    const fading = Math.abs(e.targetBright-e.bright)>.005;
    const difference = Math.atan2(Math.sin(e.target-e.angle),Math.cos(e.target-e.angle));
    e.angle = instant ? e.target : e.angle+difference*(1-Math.exp(-dt*7));
    e.bright = instant ? e.targetBright : e.bright+(e.targetBright-e.bright)*(1-Math.exp(-dt*8));
    if (!instant && (Math.abs(e.targetBright-e.bright)>.005 || (e.bright>.01 && Math.abs(difference)>.01))) moving = true;
    const { width, height } = e.host.getBoundingClientRect();
    if (!width || !height) continue;
    const ratio = dpr();
    const w = Math.round((width+8)*ratio), h = Math.round((height+8)*ratio);
    if (!fading && e.bright<.005 && e.targetBright===0 && e.canvas.width===w && e.canvas.height===h) continue;
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width=w; e.canvas.height=h; }
    renderer.dpr=ratio;
    renderer.setSize(width+8,height+8);
    program.uniforms.uHalfSize.value=[width*ratio/2,height*ratio/2];
    program.uniforms.uCenter.value=[(width/2+4)*ratio,(height/2+4)*ratio];
    program.uniforms.uDpr.value=ratio;
    program.uniforms.uAngle.value=e.angle;
    program.uniforms.uBright.value=e.bright;
    program.uniforms.uColor.value=e.danger ? [.96,.57,.57] : [1,.88,.65];
    renderer.render({scene:mesh});
    e.context.clearRect(0,0,w,h);
    e.context.drawImage(renderer.gl.canvas,0,0,w,h);
  }
  if (moving) frame=requestAnimationFrame(paint);
}

function move(event: PointerEvent) { if (event.pointerType !== 'touch') { pointer={x:event.clientX,y:event.clientY}; targets(); } }
function leave() { pointer=null; targets(); }

export function SpecularRim({ danger = false }: { danger?: boolean }) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas=ref.current, host=canvas?.parentElement;
    const context=canvas?.getContext('2d');
    if (!canvas || !host || !context) return;
    try {
      if (!renderer) {
        renderer=new Renderer({alpha:true,premultipliedAlpha:true,antialias:true,dpr:dpr(),preserveDrawingBuffer:true});
        renderer.gl.clearColor(0,0,0,0);
        const geometry=new Triangle(renderer.gl);
        delete geometry.attributes.uv;
        program=new Program(renderer.gl,{vertex,fragment,uniforms:{uHalfSize:{value:[1,1]},uCenter:{value:[0,0]},uAngle:{value:2.4},uBright:{value:0},uDpr:{value:1},uColor:{value:[1,.88,.65]}}});
        mesh=new Mesh(renderer.gl,{geometry,program});
      }
    } catch { renderer=undefined; return; }
    const entry: Entry={canvas,host,context,danger,angle:2.4,target:2.4,bright:0,targetBright:0};
    entries.add(entry);
    if (entries.size===1) {
      window.addEventListener('pointermove',move,{passive:true});
      window.addEventListener('pointerout',out);
      window.addEventListener('scroll',targets,true);
      window.addEventListener('focusin',targets);
      window.addEventListener('focusout',targets);
    }
    const observer=new ResizeObserver(targets);
    observer.observe(host);
    targets();
    return () => {
      observer.disconnect(); entries.delete(entry);
      if (!entries.size) {
        cancelAnimationFrame(frame); frame=0; pointer=null;
        window.removeEventListener('pointermove',move); window.removeEventListener('pointerout',out);
        window.removeEventListener('scroll',targets,true); window.removeEventListener('focusin',targets); window.removeEventListener('focusout',targets);
        mesh?.geometry.remove(); program?.remove(); renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
        renderer=undefined; mesh=undefined; program=undefined;
      }
    };
  },[danger]);
  return <canvas ref={ref} aria-hidden="true" data-specular-rim="true" style={{position:'absolute',inset:-4,width:'calc(100% + 8px)',height:'calc(100% + 8px)',pointerEvents:'none',zIndex:1}} />;
}
function out(event: PointerEvent) { if (!event.relatedTarget) leave(); }
