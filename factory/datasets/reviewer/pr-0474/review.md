🏭 Veredicto: puede entrar; CI verde y CA-8 y CA-9 cubiertos con pruebas que fallarían si se rompen. Solo hay hallazgos menores. SHA revisado: 93c8a3ac692a9d72deb76c5929078c48a5f9574d

**Criterios de aceptación**
- CA-9: cubierto. `groupNotes` tiene pruebas unitarias (clave source_id+url+retrieved+tier, numeración por aparición). Sobre el build, las pruebas comprueban lo siguiente:
  - cada marca apunta a un `li#fuente-n` existente;
  - la entrada lleva nombre (dominio sin www.), fecha y URL completa;
  - un dato no T1 dice «fuente no oficial» junto a la marca y en la entrada, y T1 no dice nada;
  - sin datos que citar no hay bloque.
- CA-8: cubierto. Las notas de cabecera, campos de versión, precio y specs aparecen literales. Además, una prueba recorre todos los datos reales (`data/raw`) y exige que cada `note` mostrable esté en la página.

**Hallazgos (menores)**
1. `web/tests/ficha-fuentes.test.ts`: el `import { readdirSync }` está al final del fichero. Súbelo con los demás.
2. `web/tests/ficha.test.ts`: las regex nuevas usan `\[\d\]`, que son un solo dígito. Con 10 o más notas fallaría. Usa `\d+`.
3. Las notas de `status` de un modelo `on_sale` y de un `launch` que no se muestra quedan sin pintar, y la prueba sobre datos reales las excluye. Es coherente con el diseño («sin etiqueta y sin nota») y el agente lo dijo. No es un fallo, pero la decisión queda anotada en la bitácora.
4. Se elimina la prueba «RF-4 scope» de `ficha-precio.test.ts`. Es correcto, porque ahora el bloque existe.

**Lo que no he podido comprobar**
- Foco, anillo y zona de pulsación 24×24 de las marcas `[n]`. El agente tampoco los midió; solo se cubre con a11y si hay regla.
