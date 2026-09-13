-- Catálogo de unidades de medida administrable desde Configuración.
-- Aditiva: crea la tabla y la siembra con las seis unidades que hasta ahora estaban
-- escritas a mano en los formularios, así que al desplegar nada cambia de comportamiento.
CREATE TABLE "UnidadMedida" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnidadMedida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnidadMedida_nombre_key" ON "UnidadMedida"("nombre");

INSERT INTO "UnidadMedida" ("id", "nombre", "activa") VALUES
    ('unidad-ha', 'Ha', true),
    ('unidad-hora', 'Hora', true),
    ('unidad-kg', 'Kg', true),
    ('unidad-cantidad', 'Cantidad', true),
    ('unidad-bultos', 'Bultos', true),
    ('unidad-jornales', 'Jornales', true);

-- Las unidades que ya se hubieran capturado como texto libre ("Otro…") entran al catálogo
-- para que sigan disponibles ahora que el desplegable es la única forma de elegir.
INSERT INTO "UnidadMedida" ("id", "nombre", "activa")
SELECT gen_random_uuid()::text, initcap(u.unidad), true
FROM (
    SELECT DISTINCT lower(trim("unidadRealizada")) AS unidad
    FROM "Actividad"
    WHERE "unidadRealizada" IS NOT NULL AND trim("unidadRealizada") <> ''
    UNION
    SELECT DISTINCT lower(trim("unidad")) AS unidad
    FROM "Tarea"
    WHERE "unidad" IS NOT NULL AND trim("unidad") <> ''
    UNION
    SELECT DISTINCT lower(trim("unidad")) AS unidad
    FROM "ActividadEstipulada"
    WHERE trim("unidad") <> ''
) AS u
WHERE u.unidad NOT IN ('ha', 'hora', 'kg', 'cantidad', 'bultos', 'jornales');
