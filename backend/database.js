
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Crear la carpeta de la base de datos
const carpetaDB = path.join(__dirname, 'data');

if (!fs.existsSync(carpetaDB)) {
    fs.mkdirSync(carpetaDB, { recursive: true });
}

// Conectar con SQLite
const db = new Database(
    path.join(carpetaDB, 'apolux.db')
);

db.pragma('foreign_keys = ON');

// Crear las tablas principales
db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
        id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS productos (
        id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_categoria INTEGER,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL CHECK(precio >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
        imagen TEXT,
        FOREIGN KEY (id_categoria)
            REFERENCES categorias(id_categoria)
    );

    CREATE TABLE IF NOT EXISTS clientes (
        id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        correo TEXT NOT NULL UNIQUE,
        telefono TEXT
    );

    CREATE TABLE IF NOT EXISTS pedidos (
        id_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
        id_cliente INTEGER NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL CHECK(total >= 0),
        estado TEXT NOT NULL DEFAULT 'pendiente',
        FOREIGN KEY (id_cliente)
            REFERENCES clientes(id_cliente)
    );

    CREATE TABLE IF NOT EXISTS detalle_pedido (
        id_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
        id_pedido INTEGER NOT NULL,
        id_producto INTEGER NOT NULL,
        cantidad INTEGER NOT NULL CHECK(cantidad > 0),
        precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
        FOREIGN KEY (id_pedido)
            REFERENCES pedidos(id_pedido),
        FOREIGN KEY (id_producto)
            REFERENCES productos(id_producto)
    );
`);

// Actualizar tablas creadas anteriormente
// Añadir slug a productos si todavía no existe
const columnasProductos = db.prepare(
    'PRAGMA table_info(productos)'
).all();

if (!columnasProductos.some(columna => columna.name === 'slug')) {
    db.exec('ALTER TABLE productos ADD COLUMN slug TEXT');
}

// Añadir dirección a clientes si todavía no existe
const columnasClientes = db.prepare(
    'PRAGMA table_info(clientes)'
).all();

if (!columnasClientes.some(columna => columna.name === 'direccion')) {
    db.exec('ALTER TABLE clientes ADD COLUMN direccion TEXT');
}

// Evitar que dos productos tengan el mismo identificador
db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    indice_productos_slug
    ON productos(slug)
`);

// Registrar categorías
const insertarCategoria = db.prepare(`
    INSERT OR IGNORE INTO categorias (nombre)
    VALUES (?)
`);

const categorias = [
    'Relojes',
    'Fragancias',
    'Accesorios',
    'Moda',
    'Coleccionables',
    'Deportes'
];

const registrarCategorias = db.transaction(() => {
    for (const categoria of categorias) {
        insertarCategoria.run(categoria);
    }
});

registrarCategorias();

// Productos iniciales de APOLUX
const productosIniciales = [
    {
        slug: 'reloj-elegante',
        categoria: 'Relojes',
        nombre: 'Reloj elegante',
        descripcion: 'Diseño clásico para cualquier ocasión.',
        precio: 150000,
        imagen: 'img/reloj-elegante.png'
    },
    {
        slug: 'reloj-deportivo',
        categoria: 'Relojes',
        nombre: 'Reloj deportivo',
        descripcion: 'Un estilo moderno y versátil.',
        precio: 120000,
        imagen: 'img/Reloj-deportivo.png'
    },
    {
        slug: 'perfume-masculino',
        categoria: 'Fragancias',
        nombre: 'Perfume masculino',
        descripcion: 'Una fragancia para destacar.',
        precio: 480000,
        imagen: 'img/one million.png'
    },
    {
        slug: 'cadena-masculina',
        categoria: 'Accesorios',
        nombre: 'Cadena masculina',
        descripcion: 'Un accesorio para complementar tu estilo.',
        precio: 55000,
        imagen: 'img/cadena-masculina.jpg'
    },
    {
        slug: 'billetera-premium',
        categoria: 'Accesorios',
        nombre: 'Billetera premium',
        descripcion: 'Práctica y elegante para el día a día.',
        precio: 65000,
        imagen: 'img/billetera-premium.jpg'
    },
    {
        slug: 'camiseta-deportiva',
        categoria: 'Moda',
        nombre: 'Camiseta deportiva',
        descripcion: 'Comodidad y estilo para cualquier momento.',
        precio: 79900,
        imagen: 'img/camiseta-deportiva.jpg'
    },
    {
        slug: 'carro-coleccion',
        categoria: 'Coleccionables',
        nombre: 'Carro de colección',
        descripcion: 'Una miniatura para los amantes de los autos.',
        precio: 261000,
        imagen: 'img/carro-coleccion.png'
    },
    {
        slug: 'moto-coleccion',
        categoria: 'Coleccionables',
        nombre: 'Moto de colección',
        descripcion: 'Un detalle especial para coleccionistas.',
        precio: 115000,
        imagen: 'img/moto-coleccion.png'
    },
    {
        slug: 'balon-baloncesto',
        categoria: 'Deportes',
        nombre: 'Balón de baloncesto',
        descripcion: 'Para quienes viven su pasión por el deporte.',
        precio: 80000,
        imagen: 'img/balon-basketboll.png'
    }
];

const insertarProducto = db.prepare(`
    INSERT OR IGNORE INTO productos
    (id_categoria, nombre, descripcion, precio, stock, imagen, slug)
    VALUES (
        (SELECT id_categoria FROM categorias WHERE nombre = @categoria),
        @nombre,
        @descripcion,
        @precio,
        10,
        @imagen,
        @slug
    )
`);

const registrarProductos = db.transaction(() => {
    for (const producto of productosIniciales) {
        insertarProducto.run(producto);
    }
});

registrarProductos();

console.log('Base de datos APOLUX conectada correctamente.');

module.exports = db;
