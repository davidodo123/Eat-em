---
tags: [casos-de-uso]
---
# Casos de uso

Situaciones reales que se prueban con un navegador de verdad, en tamaño móvil. Las ejecuta `npm run casos` (`tareas/casos-de-uso.ts`):

- `npm run casos`: todos menos los de IA.
- `npm run casos -- --ia`: también el chat y la semana con IA (gasta ~8-20 de las 50 peticiones diarias).
- `npm run casos -- --solo L,C`: solo esos grupos.
- `CASOS_BASE=http://localhost:3100 npm run casos`: contra un build local (`npm run build && npx next start -p 3100`).

Crea cuentas `prueba-temporal-*@example.com` y las borra al acabar con sus hogares. No toca datos de nadie ni el catálogo. Usa el Chrome instalado.

Último resultado: ver [[Diario/2026-11-05]].

## Acceso y sesión
- **A1** Sin sesion, una pantalla privada lleva a Entrar y recuerda adonde iba
- **A2** Contrasena incorrecta: mensaje claro y no entra
- **A3** Al entrar vuelve a la pantalla que pedia
- **A9** Al entrar sin destino queda en /lista con su pestana marcada
- **A4** Un enlace de entrada no puede mandar a otra web
- **A5** Con sesion, Entrar y la portada llevan a la Lista
- **A6** Enlaces antiguos /hoy e /inventario siguen funcionando
- **A7** Cerrar sesion deja fuera y se puede volver a entrar
- **A8** Una pagina que no existe da 404, no un error

## Hogar
- **H1** Sin hogar: Lista, Despensa y Ubicacion piden crearlo
- **H2** Nombre de hogar solo con espacios: se rechaza
- **H3** Codigo de invitacion mal escrito o inexistente
- **H4** Crear un hogar da un codigo de invitacion
- **H5** La segunda persona se une escribiendo el codigo en minusculas
- **H6** Solo quien administra cambia los dias de la lista
- **H7** Tercera persona en otro hogar

## Ubicación
- **U1** Codigo postal no valido
- **U2** Sin codigo ni GPS: lo pide
- **U3** Codigo postal bueno: guarda y muestra las tiendas cercanas
- **U4** Las cadenas sin catalogo salen con su nombre y como sin datos
- **U5** La ubicacion se comparte: la otra persona del hogar la ve

## Lista
- **L1** Escribir una sola letra no busca
- **L2** Una busqueda sin resultados lo dice y permite anadirlo tal cual
- **L3** Buscar solo devuelve tiendas cercanas, con precio
- **L4** Anadir un producto muestra precio, tienda y total
- **L5** Anadir el mismo producto otra vez suma un envase y el total sube
- **L6** Mas y menos cambian la cantidad y no baja de 1
- **L7** Texto libre con acentos y emoji
- **L8** Texto con codigo HTML no se ejecuta (XSS)
- **L9** Texto larguisimo: se recorta y no rompe la pantalla
- **L10** Quitar una linea
- **L11** Compartir saca el texto de la lista

## Compartir en el hogar
- **C1** Lo que anade una persona lo ve la otra al abrir
- **C2** Tiempo real: aparece sin recargar en el otro movil
- **C3** Tiempo real tras visitar otra pestana y volver (cache de pestanas)
- **C4** Lo que compra una persona aparece en la despensa de la otra

## Seguridad entre hogares
- **S1** Otro hogar no ve mi lista ni mi despensa, ni en pantalla ni por la API
- **S2** Otro hogar no puede escribir en mi lista ni borrarla
- **S3** Los datos de salud son solo de cada persona, ni el hogar los ve
- **S4** Sin sesion no se llega a los datos ni con la clave publica
- **S5** El cron de avisos no se puede lanzar desde fuera
- **S6** Nadie puede cambiar el precio del catalogo

## Despensa
- **D1** Anadir desde el buscador de la despensa
- **D2** Sumar y gastar unidades
- **D3** Caducidad cercana: pasa a Caduca pronto
- **D4** Producto caducado: lo avisa
- **D5** Cambiarlo de sitio y filtrar por Nevera y Congelador
- **D6** Filtro inventado en la direccion: no rompe
- **D7** Tirar un producto estropeado
- **D8** Lo que se acaba vuelve a la lista

## Dieta
- **T1** Guardar una comida sin nombre: se rechaza
- **T2** Comida a mano con ingrediente
- **T3** Moverse de semana y volver a hoy
- **T4** Vista mes con los puntos de los dias con comida
- **T5** Fecha rara en la direccion: va a hoy, no rompe
- **T6** Fecha en una semana pasada no ofrece rehacer con IA
- **T7** Marcar hecha y deshacer
- **T8** Saltar una comida
- **T9** ¿Que me falta? una vez y otra sin duplicar
- **T10** Con lo que falta en casa, ¿Que me falta? deja de pedirlo
- **T11** Repetir la semana y que no pise lo ya copiado
- **T12** Borrar una comida
- **T13** Apuntar algo fuera del plan

## Perfil y salvaguardas de salud
- **P1** Sin perfil, la Dieta invita a completarlo
- **P2** Sin consentimiento no se calculan objetivos
- **P3** Perfil normal: objetivos en Perfil y en Dieta
- **P4** Menor de edad: deriva a un profesional y no da objetivos
- **P5** Menor: la IA no genera plan y deriva (sin gastar peticiones)
- **P6** IMC muy bajo: deriva
- **P7** Altura o peso imposibles: pide el dato, no calcula
- **P8** Enfermedad marcada: deriva

## Comparar precios
- **M1** Comparar un ingrediente ordena por precio por kilo/litro
- **M2** Comparar solo muestra tiendas cercanas
- **M3** Ingrediente inventado en la direccion: no rompe

## Escanear
- **E1** Escanear: un codigo corto no deja buscar
- **E2** Escanear: codigo de un producto del catalogo
- **E3** Escanear: codigo desconocido ofrece darlo de alta (no se guarda)

## Móvil y aspecto
- **V1** Ninguna pantalla desborda a lo ancho en un movil pequeno (320 px)
- **V2** Tema oscuro guardado se aplica sin parpadeo
- **V3** Cambiar de pestana es instantaneo
- **V4** La pestana activa se marca, tambien en las pantallas interiores
- **V5** Manifest de la PWA abre en la Lista y tiene icono
- **V6** Avisos: la pantalla ofrece activarlos

## IA (con `--ia`, gastan cupo)
- **I1** Chat: responde a una duda normal
- **I2** Rellenar la semana con IA con los objetivos del perfil

## General
- **Z1** Ningun error de JavaScript ni 5xx en todo el recorrido
