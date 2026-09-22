import type { NextConfig } from "next";

// O app (Expo Router, export estatico em public/app) e servido no mesmo dominio
// da landing para que o cookie de sessao do Supabase valha nos dois. O export
// gera um arquivo .html por rota, entao cada rota do app precisa ser reescrita
// para o arquivo correspondente. Rotas dinamicas viram "[id].html".
const appRewrites = [
  { source: "/app", destination: "/app/index.html" },
  { source: "/app/tournament/create", destination: "/app/tournament/create.html" },
  { source: "/app/tournament/:id", destination: "/app/tournament/%5Bid%5D.html" },
  { source: "/app/blinds/:id", destination: "/app/blinds/%5Bid%5D.html" },
  { source: "/app/display/:id", destination: "/app/display/%5Bid%5D.html" },
  { source: "/app/:page(ai|history|profile|ranking|_sitemap)", destination: "/app/:page.html" },
];

const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: appRewrites, afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
