🏭 Veredicto: puede entrar; CI verde y los dos CA cubiertos. Solo falta, como detalle, que el cuerpo diga «Closes #324». SHA revisado: 714c7a96f462e393d30d43bbd81229d05ecfdfae

**Criterios de aceptación**
- CA-8: cubierto. La prueba construye la web y exige un único enlace `/comparar/?v=acme/Volta` con texto «Comparar» y texto oculto, después del enlace de marca, en su propia línea, sin `rel` ni `data-web-marca`.
- CA-13 (ficha): cubierto. `announced` sin versiones y `discontinued` no llevan enlace. `needs_review` no genera ficha, y la prueba lo comprueba.

**Hallazgos**
1. Menor: el cuerpo de la PR no contiene «Closes #324», así que el issue no se cerrará solo. Añádelo, o ciérralo a mano al fusionar.
2. Menor: la historia dice que se actualice `web/tests/ficha.test.ts` si fija los enlaces de la cabecera. La PR no lo toca y la CI está verde, así que no hace falta.

Reutiliza `card.compare` (`isComparable`) en lugar de duplicar el criterio. Sin dependencias nuevas y con entrada en la bitácora.
