# Autorización y política de sesión — muestra ejecutable

Código extraído y adaptado del e-commerce Camdis para evaluar la separación entre clientes y personal, controles de roles y protección CSRF.

## Ejecutar

Con Node.js 22 o posterior, desde la raíz del repositorio:

```sh
cd sample
npm test
```

No requiere instalar dependencias, levantar servicios ni configurar credenciales. Las 15 pruebas pasaron localmente el 21/09/2026. [Ver ejecución automática](https://github.com/Dante2617012022/camdis-ecommerce-case-study/actions/workflows/sample.yml).

## Procedencia y cambios

- `src/authorization.js` procede del módulo de autorización del proyecto privado consultado el 21/09/2026. Conserva la lógica de los guards; se envolvió en `createAuthorization` para inyectar el resolvedor de autenticación. Las exportaciones internas se devuelven desde la fábrica.
- `src/sessionPolicy.js` contiene las funciones de contexto, reducción de roles del cliente y comprobación CSRF extraídas de la implementación de sesiones. Se exportaron las funciones necesarias para probarlas.
- Los tests, el paquete independiente y el workflow se crearon para esta muestra. Las identidades y tokens de prueba son ficticios.
- No se copió el historial privado, la configuración, los secretos, la base de sesiones ni el proveedor de identidad.

## Qué puede revisar un evaluador

| Control | Evidencia local |
|---|---|
| Separación del contexto interno | El guard solicita `admin` y `allowBearer: false`; una sesión cliente no satisface ese acceso |
| Autorización por roles | Casos permitidos y rechazos 403 ante roles insuficientes, desconocidos o con otra capitalización |
| Identidad ausente | Respuesta 401 antes de continuar |
| Mutaciones con cookie | CSRF ausente o incorrecto provoca error; un CSRF válido no reemplaza el permiso por rol |
| Reducción de privilegios del cliente | La política conserva el sujeto y reemplaza los roles por `CUSTOMER`, sin mutar la identidad original |
| Contexto desconocido | Error explícito en lugar de elegir un contexto por defecto |

## Límites y contrato de integración

**La autenticación está simulada.** El resolvedor inyectado devuelve identidades ficticias: estos tests no validan firmas JWT, audiencia, issuer, expiración, MFA, PKCE, cookies, cifrado, revocación ni persistencia. No prueban un acceso HTTP real ni un login completo con Keycloak.

El resolvedor real debe verificar las credenciales, respetar el contexto solicitado y la opción `allowBearer`. `request.auth` es estado interno confiable creado en el servidor; no puede proceder directamente del cuerpo o los headers de una solicitud. El guard presupone esa confianza y el contrato de respuesta de Fastify; los tests usan un objeto de respuesta equivalente para los métodos utilizados.

`protectAdminMutation` autentica y comprueba CSRF, pero no verifica el rol requerido por cada operación: debe combinarse con `requireAdminRoles`. La muestra prueba esa combinación. La función CSRF no autentica por sí sola y no exige ese token para Bearer; verificar el JWT corresponde al resolvedor.

La reducción de roles se prueba como función aislada. No se afirma haber reproducido aquí el almacenamiento o intercambio de cookies entre áreas. Tampoco se declara cobertura completa del e-commerce ni ausencia de vulnerabilidades.

## Para explicarlo en una entrevista

**Problema:** una tienda y su área interna necesitan límites de acceso claros, aunque una persona use ambas.

**Decisión:** separar contextos, exigir roles en el servidor y comprobar CSRF en mutaciones con sesión. Una identidad usada en el contexto cliente se limita a `CUSTOMER`.

**Evidencia:** ejecutar los tests y mostrar un rechazo por contexto, otro por rol y otro por CSRF; después, el caso permitido.

**Límite:** explicar qué verifica esta muestra y qué exige una integración real con identidad, HTTP y persistencia.

[Volver al caso de estudio](../README.md)
