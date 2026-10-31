# Tienda de Café de Origen: aplicación contenerizada en Docker

Actividad sumativa de la Unidad 2 del módulo Contenerización de Aplicaciones de Software.

Desarrollé una aplicación web para registrar el inventario de una tienda de café. Está compuesta por dos contenedores: un servidor web en Node.js con Express y una base de datos MySQL 8.4. Ambos se construyen con imágenes propias y se orquestan con Docker Compose.

## Requisitos

* Docker Desktop instalado y en ejecución.
* Conexión a internet la primera vez, para descargar las imágenes base `mysql:8.4`, `node:22-alpine` y `alpine:3.20`.

No necesito instalar Node.js ni MySQL en mi equipo: todo corre dentro de los contenedores.

## Cómo la ejecuto

Desde la carpeta del proyecto:

```bash
docker compose up -d --build
```

Cuando `docker compose ps` muestra los dos servicios como `healthy`, abro http://localhost:3000.

Para detenerla sin perder los datos:

```bash
docker compose down
```

Para borrar también los datos y empezar de cero:

```bash
docker compose down -v
```

## Páginas de la aplicación

| Ruta | Qué hace |
|---|---|
| `/` | Inicio con el avance hacia los 15 productos y los últimos registros. |
| `/productos/nuevo` | Formulario para registrar productos en la tabla `productos`. |
| `/categorias/nueva` | Formulario para registrar categorías en la tabla `categorias`. |
| `/registros` | Enlace independiente que muestra el contenido de las dos tablas leído desde MySQL. |
| `/contenedor` | Evidencia de que la aplicación corre dentro de Docker: identificador del contenedor, versiones y arquitectura. |
| `/salud` | Respuesta JSON que usa el HEALTHCHECK del contenedor. |

## Estructura

```
tienda-cafe-docker/
├── docker-compose.yml   orquestación de los servicios db y web
├── .env                 credenciales y puertos
├── db/
│   ├── Dockerfile       imagen tienda-cafe-db basada en mysql:8.4
│   └── init.sql         script de la base de datos
├── web/
│   ├── Dockerfile       imagen tienda-cafe-web basada en node:22-alpine
│   ├── package.json
│   ├── src/
│   │   ├── server.js    rutas y lógica de la aplicación
│   │   ├── db.js        conexión a MySQL con reintentos
│   │   └── validacion.js validaciones del lado del servidor
│   ├── views/           plantillas EJS de la interfaz
│   └── public/          hoja de estilos e icono
└── demo-imagen/
    └── Dockerfile       imagen mínima para la demostración de crear y eliminar
```

## Modelo de datos

Relación de uno a muchos: una categoría tiene muchos productos y cada producto pertenece a una categoría mediante la llave foránea `productos.categoria_id`.

| categorias | productos |
|---|---|
| id INT (PK) | id INT (PK) |
| codigo CHAR(4) único | categoria_id INT (FK a categorias.id) |
| nombre VARCHAR(60) | nombre VARCHAR(100) |
| descripcion TEXT | precio DECIMAL(10,2) |
| activa BOOLEAN | cantidad SMALLINT UNSIGNED |
| fecha_creacion DATE | disponible BOOLEAN |
| creado_en DATETIME | fecha_tostion DATE |

El script `db/init.sql` crea las tablas e inserta tres categorías iniciales. Los quince productos se ingresan desde la interfaz.

## Decisiones técnicas

* Elegí imágenes propias para ambos servicios, en lugar de usar las oficiales sin cambios, para que el script de la base de datos viaje dentro de la imagen.
* La web espera a que MySQL responda gracias a `depends_on` con `condition: service_healthy`, y además reintenta la conexión al arrancar.
* Todas las consultas usan parámetros (`?`), así que los datos del formulario nunca se concatenan dentro del SQL.
* Después de guardar aplico el patrón POST, redirección y GET, para que recargar la página no duplique registros.
* Valido los datos en el navegador y otra vez en el servidor, porque la validación del cliente se puede saltar.
* El contenedor web corre con el usuario `node` y no como root.
* Los datos viven en el volumen `db_data`, por eso sobreviven a `docker compose down`.

## Entregables

1. Código fuente de la aplicación web: carpeta `web/` y archivos de Docker.
2. Script de la base de datos: `db/init.sql`.
3. Enlace del video, publicado con visibilidad pública.

## Despliegue en Kubernetes (Unidad 3)

Para el foro de la Unidad 3 seleccioné Google Kubernetes Engine (GKE). No pude crear el clúster administrado: la política de acceso de mi universidad bloquea Azure desde equipos personales (error 53003) y Google Cloud exige un prepago para abrir la facturación. Por eso desplegué la aplicación en un clúster de Kubernetes con minikube dentro de Google Cloud Shell, que es gratuito. Más abajo documento cómo sería el despliegue en GKE con los mismos manifiestos.

Reutilicé las dos imágenes de la Unidad 2 y reemplacé Docker Compose por manifiestos de Kubernetes, que están en la carpeta `k8s/`.

| Archivo | Recursos |
|---|---|
| `k8s/namespace.yaml` | Namespace `tienda-cafe`. |
| `k8s/configmap.yaml` | Configuración no secreta: host, puerto y nombre de la base, zona horaria y nombre de la plataforma. |
| `k8s/mysql.yaml` | Service sin IP propia y StatefulSet de MySQL con un PersistentVolumeClaim de 10 GiB en la clase de disco predeterminada del clúster. |
| `k8s/web.yaml` | Deployment del servidor web con dos réplicas y un Service de tipo LoadBalancer. |
| `k8s/kustomization.yaml` | Une los archivos anteriores y pone el prefijo de las imágenes. |
| `k8s/extra/hpa.yaml` | Escalado automático del servidor web entre 2 y 4 réplicas según el uso de CPU. |
| `k8s/extra/carga.yaml` | Pod temporal que genera carga para probar el escalado automático. |

Las contraseñas no están en el repositorio: las guardo en un Secret que creo con `kubectl`.

### Pasos que sigo en Google Cloud Shell con minikube

Cloud Shell ya trae `kubectl`, Docker y Git; además permite usar minikube. Creo el clúster y activo el servidor de métricas, que necesita el escalado automático:

```bash
minikube start
minikube addons enable metrics-server
kubectl get nodes
```

Descargo el proyecto y construyo las imágenes dentro del Docker de minikube, así el clúster las encuentra sin un registro:

```bash
git clone https://github.com/DarguinBarbosa/tienda-cafe-docker.git
cd tienda-cafe-docker
eval $(minikube docker-env)
docker build -t local/tienda-cafe-db:1.0 ./db
docker build -t local/tienda-cafe-web:1.0 ./web
```

Despliego la aplicación:

```bash
sed -i "s#MI_REGISTRO#local#g" k8s/kustomization.yaml k8s/extra/carga.yaml
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic tienda-cafe-secretos -n tienda-cafe --from-literal=MYSQL_ROOT_PASSWORD=root_cafe_2026 --from-literal=MYSQL_USER=app --from-literal=MYSQL_PASSWORD=app_cafe_2026
kubectl apply -k k8s
kubectl get pods -n tienda-cafe --watch
```

Para abrir la tienda en el navegador, en otra pestaña de Cloud Shell dejo corriendo un reenvío de puerto y uso **Vista previa web en el puerto 8080**. El ciclo vuelve a conectar el reenvío si el pod al que apunta se reemplaza:

```bash
while true; do kubectl port-forward --address 0.0.0.0 -n tienda-cafe service/web 8080:80; sleep 1; done
```

En minikube el Service de tipo LoadBalancer no recibe IP externa, pero sí un NodePort. Con él compruebo desde Cloud Shell que las peticiones se reparten entre las réplicas:

```bash
URL=$(minikube service web -n tienda-cafe --url)
for i in 1 2 3 4 5 6 7 8; do curl -s $URL/salud; echo; done
```

### Cómo sería el despliegue en GKE

Con la facturación activa, los manifiestos son los mismos. Solo cambian el lugar donde construyo las imágenes y el prefijo:

```bash
PROYECTO=$(gcloud config get-value project)
REGION=us-central1
REGISTRO=$REGION-docker.pkg.dev/$PROYECTO/tienda-cafe
gcloud services enable container.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create tienda-cafe --repository-format=docker --location=$REGION
gcloud container clusters create-auto tienda-cafe --location=$REGION
gcloud container clusters get-credentials tienda-cafe --location=$REGION
gcloud auth configure-docker $REGION-docker.pkg.dev
docker build -t $REGISTRO/tienda-cafe-db:1.0 ./db && docker push $REGISTRO/tienda-cafe-db:1.0
docker build -t $REGISTRO/tienda-cafe-web:1.0 ./web && docker push $REGISTRO/tienda-cafe-web:1.0
sed -i "s#MI_REGISTRO#$REGISTRO#g" k8s/kustomization.yaml k8s/extra/carga.yaml
```

Después creo el namespace, el Secret y aplico `kubectl apply -k k8s` igual que en minikube. En GKE el Service de tipo LoadBalancer sí recibe una IP pública y el PersistentVolumeClaim crea un disco persistente balanceado. Al terminar borro primero los namespaces, porque GKE conserva los discos al eliminar el clúster y podría no borrar los balanceadores.

### Qué cambié en la aplicación para Kubernetes

* La página `/contenedor` detecta Kubernetes con la variable `KUBERNETES_SERVICE_HOST`, porque los nodos usan containerd y no crean el archivo `/.dockerenv`. Muestra el pod, el nodo, el namespace y la IP que entrega la Downward API.
* Separé las sondas: `/vivo` responde sin consultar la base y lo uso como livenessProbe; `/salud` sí consulta MySQL y lo uso como readinessProbe. Así, si la base falla, Kubernetes deja de enviar tráfico a los pods web sin reiniciarlos en cascada.
* La aplicación atiende la señal SIGTERM y cierra sus conexiones, por eso los rolling updates no esperan el periodo de gracia completo.
* La versión se fija al construir la imagen con `--build-arg APP_VERSION` y aparece en el encabezado, lo que permite ver el reemplazo de pods durante una actualización.

### Al terminar

```bash
minikube delete
```

Borra el clúster de minikube con todo lo que contiene.
