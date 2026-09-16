const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizDoApp = __dirname;
const raizDoMonorepo = path.resolve(raizDoApp, '../..');

const config = getDefaultConfig(raizDoApp);

/* Num monorepo o Metro precisa ser ensinado duas coisas.
 *
 * 1. QUE ARQUIVOS OBSERVAR. Por padrao ele so olha a pasta do app, entao
 *    mudanca em packages/ nao recarregaria nada.
 * 2. ONDE PROCURAR MODULO, E EM QUE ORDEM. O node_modules do app vem
 *    PRIMEIRO de proposito: o site usa React 19.2.8 e o Expo SDK 54 exige
 *    19.1.0, entao o React do app fica aninhado enquanto o do site sobe
 *    para a raiz. Invertendo a ordem, o app carrega o React do site e
 *    quebra em tempo de execucao, que e mais caro de diagnosticar do que
 *    uma falha de build.
 */
config.watchFolders = [raizDoMonorepo];
config.resolver.nodeModulesPaths = [
  path.resolve(raizDoApp, 'node_modules'),
  path.resolve(raizDoMonorepo, 'node_modules')
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
