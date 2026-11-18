
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());

// Mostrar la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Archivos de diseño y JavaScript
app.use('/img', express.static(
    path.join(__dirname, '..', 'img')
));

app.use('/styles.css', express.static(
    path.join(__dirname, '..', 'styles.css')
));

app.use('/script.js', express.static(
    path.join(__dirname, '..', 'script.js')
));

// Comprobar que el servidor puede consultar SQLite
app.get('/api/estado', (req, res) => {
    try {
        db.prepare('SELECT 1 AS conexion').get();

        res.json({
            mensaje: 'Servidor APOLUX funcionando correctamente',
            baseDatos: 'Conectada'
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al consultar la base de datos'
        });
    }
});

// Consultar todos los productos
app.get('/api/productos', (req, res) => {
    try {
        const productos = db.prepare(`
            SELECT
                productos.id_producto,
                productos.slug,
                productos.nombre,
                productos.descripcion,
                productos.precio,
                productos.stock,
                productos.imagen,
                categorias.nombre AS categoria
            FROM productos
            LEFT JOIN categorias
                ON productos.id_categoria = categorias.id_categoria
            ORDER BY productos.id_producto
        `).all();

        res.json(productos);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'No se pudieron consultar los productos'
        });
    }
});

// Registrar un cliente y su pedido
app.post('/api/pedidos', (req, res) => {
    try {
        const { nombre, correo, telefono, direccion, productos } = req.body;

        // Validar los datos del cliente
        if (
            typeof nombre !== 'string' ||
            nombre.trim().length < 3 ||
            typeof correo !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
            typeof telefono !== 'string' ||
            telefono.trim().length < 7 ||
            typeof direccion !== 'string' ||
            direccion.trim().length < 5
        ) {
            return res.status(400).json({
                error: 'Verifica los datos del cliente'
            });
        }

        if (
            !Array.isArray(productos) ||
            productos.length === 0 ||
            productos.length > 50
        ) {
            return res.status(400).json({
                error: 'El pedido no contiene productos válidos'
            });
        }

        // Validar los productos y sus cantidades
        for (const item of productos) {
            if (
                typeof item.slug !== 'string' ||
                !Number.isInteger(item.cantidad) ||
                item.cantidad < 1 ||
                item.cantidad > 100
            ) {
                return res.status(400).json({
                    error: 'Hay productos o cantidades inválidas'
                });
            }
        }

        // Registrar todo el pedido en una transacción
        const registrarPedido = db.transaction(() => {
            const insertarCliente = db.prepare(`
                INSERT INTO clientes (nombre, correo, telefono, direccion)
                VALUES (@nombre, @correo, @telefono, @direccion)
                ON CONFLICT(correo) DO UPDATE SET
                    nombre = excluded.nombre,
                    telefono = excluded.telefono,
                    direccion = excluded.direccion
            `);

            insertarCliente.run({
                nombre: nombre.trim(),
                correo: correo.trim().toLowerCase(),
                telefono: telefono.trim(),
                direccion: direccion.trim()
            });

            const cliente = db.prepare(`
                SELECT id_cliente
                FROM clientes
                WHERE correo = ?
            `).get(correo.trim().toLowerCase());

            const consultarProducto = db.prepare(`
                SELECT id_producto, nombre, precio, stock
                FROM productos
                WHERE slug = ?
            `);

            const lineas = productos.map(item => {
                const producto = consultarProducto.get(item.slug);

                if (!producto) {
                    throw new Error('Uno de los productos no existe');
                }

                if (producto.stock < item.cantidad) {
                    throw new Error(
                        `No hay suficiente stock de ${producto.nombre}`
                    );
                }

                return {
                    ...producto,
                    cantidad: item.cantidad
                };
            });

            const total = lineas.reduce((suma, item) => {
                return suma + item.precio * item.cantidad;
            }, 0);

            const pedido = db.prepare(`
                INSERT INTO pedidos (id_cliente, total, estado)
                VALUES (?, ?, 'pendiente')
            `).run(cliente.id_cliente, total);

            const insertarDetalle = db.prepare(`
                INSERT INTO detalle_pedido
                (id_pedido, id_producto, cantidad, precio_unitario)
                VALUES (?, ?, ?, ?)
            `);

            const actualizarStock = db.prepare(`
                UPDATE productos
                SET stock = stock - ?
                WHERE id_producto = ?
            `);

            for (const item of lineas) {
                insertarDetalle.run(
                    pedido.lastInsertRowid,
                    item.id_producto,
                    item.cantidad,
                    item.precio
                );

                actualizarStock.run(
                    item.cantidad,
                    item.id_producto
                );
            }

            return {
                id_pedido: pedido.lastInsertRowid,
                total
            };
        });

        const resultado = registrarPedido();

        res.status(201).json({
            mensaje: 'Pedido de demostración registrado correctamente',
            pedido: resultado
        });

    } catch (error) {
        console.error(error);

        res.status(400).json({
            error: error.message || 'No se pudo registrar el pedido'
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`APOLUX funcionando en http://localhost:${PORT}`);
});

