---
name: spec-generator
description: "Usa esta skill cuando el usuario pida crear, redactar o revisar una especificación (spec) de una funcionalidad. Guía una entrevista de requisitos y produce un spec.md siguiendo la plantilla del equipo."
---
# Generador de specs

Convierte una idea vaga en una especificación acordada. La spec es el
contrato: si algo no está aquí, no se implementa.

## Proceso
1. **Lee el contexto.** `.specify/memory/constitution.md` si existe, y las specs previas
   de `specs/` para respetar convenciones y no contradecir lo acordado.
2. **Entrevista al usuario.** Preguntas de UNA en UNA, máximo 6, esperando
   respuesta antes de la siguiente. Céntrate en casos límite, errores y qué
   queda fuera. No propongas soluciones técnicas: si preguntan "¿cómo lo
   harías?", redirige al QUÉ. Prioriza preguntas cuya respuesta cambie lo que
   hay que construir; descarta las que tengan respuesta obvia por defecto.
3. **Elige el número.** Mira `specs/` y usa el siguiente libre con tres
   dígitos: `specs/NNN-<nombre-en-kebab-case>/spec.md`.
4. **Redacta** con `spec-template.md` de esta skill, sin saltar secciones.
   Criterios de aceptación SIEMPRE en notación EARS, numerados RF-1, RF-2…
   Cada requisito debe ser verificable: si no sabes cómo comprobarlo, está mal.
5. **Marca lo que no sepas** como `[NECESITA ACLARACIÓN: pregunta concreta]`.
   Nunca rellenes un hueco inventando.
6. **Pide aprobación explícita** al terminar. No pases al plan ni escribas
   código hasta tenerla.

## Reglas
- La spec describe QUÉ y POR QUÉ. Prohibido: stack, arquitectura, nombres de
  archivos, esquemas de datos, algoritmos, firmas de funciones.
- Incluye SIEMPRE "Fuera de alcance".
- Un requisito, una frase. Si necesitas un "y" para unir dos comportamientos,
  son dos requisitos.
- Sin adjetivos no medibles ("rápido", "intuitivo", "robusto"): escribe el
  umbral o no lo escribas.
- Idioma: el de la constitución. Si no la hay, el del usuario.

## Notación EARS
| Patrón | Forma | Cuándo |
|---|---|---|
| Ubicuo | EL SISTEMA <hará> | siempre cierto |
| Evento | CUANDO <disparador>, EL SISTEMA <hará> | responde a algo |
| Estado | MIENTRAS <estado>, EL SISTEMA <hará> | durante una condición |
| Opcional | DONDE <característica>, EL SISTEMA <hará> | solo si está presente |
| No deseado | SI <condición>, ENTONCES EL SISTEMA <hará> | errores y límites |

## Al revisar una spec existente
No reescribas: DETECTA y LISTA, numerado, en cuatro bloques: (1) ambigüedades,
(2) contradicciones, (3) casos límite no cubiertos, (4) conflictos con la
constitución. No propongas soluciones hasta que te lo pidan.
