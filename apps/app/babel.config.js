module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          /* `persist` vem de `zustand/middleware`, e esse módulo traz junto o
             `devtools`, que lê `import.meta.env`. O preset do Expo já
             transforma `import.meta` no ambiente de servidor, mas não no
             cliente: o resultado era o web hidratar com
             "Cannot use 'import.meta' outside a module" e ficar em branco,
             com o HTML do servidor renderizado por baixo.

             Hermes também não entende `import.meta`, então ligar isto protege
             o app nativo do mesmo problema no dia em que algum outro pacote
             usar a sintaxe. */
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
