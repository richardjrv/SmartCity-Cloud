# Integración futura

Esta etapa no incluye servicios de red ni bases de datos. Los semáforos, parqueadero,
alumbrado e inundaciones disponen de fuentes virtuales identificadas en sus tarjetas.

Cuando se autorice la integración, este directorio podrá contener un cliente HTTP
para una API ASP.NET Core. Ese cliente transformará las respuestas al contrato de
`src/domain/city-state.js`; `null` representa una lectura aún no disponible.
SQL Server y la comunicación con ESP32 deberán gestionarse desde el backend.
El navegador no recibirá credenciales de base de datos.

La presentación está en `ui/`, la carga y cámara 3D en `scene/` y los nombres
invariables de los objetos en `config/model.js`. El cargador devuelve un registro
de referencias a los 22 objetos; actualmente sólo se verifica su existencia.
El módulo `traffic/` contiene la automatización aprobada de semáforos. Su controlador
acepta `setSensors({ A1, A2, B1, B2 })` con booleanos; una futura fuente física puede
reemplazar los controles virtuales sin mezclar lógica, DOM y Three.js.
El parqueadero tiene `setSensorStates()` con validación y bloqueo durante maniobras.
El alumbrado recibe lecturas relativas mediante `setLdrReading()`; el ciclo temporal
es exclusivo de la demostración virtual y se desactiva al fijar una lectura.

`environment-telemetry.js` prepara una fuente de inundación de sólo lectura, **no
montada ni conectada**. `update()` exige nivel de piscina, almacenamiento receptor,
lluvia, bomba, zumbador, silenciamiento y fecha confirmados. Antes de recibir un
paquete válido su estado es `null`. No tiene reloj ni método de llenado temporal:
los porcentajes futuros serán mediciones recibidas, nunca resultados de un caudal
ficticio. No envía órdenes físicas ni afirma que haya un ESP32 conectado.

Una futura integración necesita definir transporte, calibración, pérdida de conexión,
confirmación de actuadores y protecciones físicas. No basta con cambiar la etiqueta
«simulación» ni montar el controlador temporal junto a sensores reales.

Estación ambiental, residuos y pantalla digital permanecen pendientes.
