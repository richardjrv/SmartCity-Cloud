# Integración de telemetría

`parent-telemetry.js` consulta cada 15 segundos el endpoint autenticado
`GET /sensores/maqueta` del sitio anfitrión. El sitio adjunta la sesión existente; el
iframe no almacena ni recibe credenciales. Solo una lectura de menos de 10 minutos
que incluya temperatura y humedad reemplaza los valores de la estación ambiental.
Si falta el controlador o la lectura está antigua, la tarjeta indica la causa y sigue
mostrando la simulación. El resto de los módulos conserva su comportamiento virtual.

El endpoint selecciona el controlador marcado activo en `dispositivos_iot` y su última
lectura en `lecturas_sensores`. `011_modelo_logico_sensores.sql` añade las entidades del
diagrama lógico del proyecto, mientras conserva esas tablas antiguas para el firmware.
El catálogo `sensores` queda listo para asociar sensores físicos y objetos del GLB cuando
se conozcan los códigos, modelos, magnitudes y ubicaciones reales.

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

La API registra cada orden confirmada en `comandos` con estado `pendiente`. Eso deja
trazabilidad, pero no la envía al ESP32: se necesita implementar el transporte y el
acuse físico antes de mostrar una ejecución como completada.

Sensores para semáforos, estacionamiento, alumbrado, inundación y residuos permanecen
pendientes de identificar y calibrar. No se asignan a piezas 3D por suposición.
