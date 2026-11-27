require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Importar modelos de Sequelize
const { sequelize, Usuario, Producto, Pedido } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cartobox-super-secret-key-2026-cambiar-en-produccion';
const JWT_EXPIRES_IN = '1h';

// Middlewares
app.use(cors());
app.use(express.json());

// MIDDLEWARE DE VERIFICACIÓN DE TOKEN (JWT)

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        req.usuario = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado. Inicia sesión nuevamente.' });
        }
        return res.status(401).json({ error: 'Token inválido.' });
    }
};

// RUTAS PÚBLICAS

app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Bienvenido al Backend de CartoBox Mexico!',
        version: '4.2.0 - Con JWT + Sequelize + Pedidos Públicos + Cambio de Estado',
        autenticacion: 'Usa POST /api/auth/login para obtener un token',
        endpoints_publicos: [
            'POST /api/auth/login',
            'POST /api/register',
            'GET  /api/products/publicos',
            'POST /api/pedidos/publicos'
        ]
    });
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    }
    try {
        const usuario = await Usuario.findOne({ where: { email, activo: true } });
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        const payload = { id: usuario.id, email: usuario.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
        res.status(200).json({
            mensaje: 'Autenticación exitosa.',
            token,
            tipo: 'Bearer',
            expiraEn: JWT_EXPIRES_IN
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// REGISTRO
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    try {
        const existe = await Usuario.findOne({ where: { email } });
        if (existe) {
            return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const nuevoUsuario = await Usuario.create({ nombre, email, passwordHash });
        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente.',
            usuario: { id: nuevoUsuario.id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ENDPOINT PÚBLICO: LISTAR PRODUCTOS (sin JWT)
app.get('/api/products/publicos', async (req, res) => {
    try {
        const productos = await Producto.findAll({
            where: { activo: true },
            attributes: ['id', 'sku', 'nombre', 'stockActual', 'categoria', 'ubicacion']
        });
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar productos.' });
    }
});

// ENDPOINT PÚBLICO: PEDIDO DE CLIENTE (sin JWT)
app.post('/api/pedidos/publicos', async (req, res) => {
    const { nombreCliente, direccionCliente, productoId, cantidad } = req.body;

    if (!nombreCliente || !direccionCliente || !productoId || !cantidad) {
        return res.status(400).json({ error: 'Nombre, dirección, producto y cantidad son obligatorios.' });
    }
    if (typeof cantidad !== 'number' || cantidad < 1) {
        return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0.' });
    }

    const t = await sequelize.transaction();
    try {
        const producto = await Producto.findByPk(productoId, { transaction: t });
        if (!producto || !producto.activo) {
            throw new Error('Producto no encontrado.');
        }
        if (producto.stockActual < cantidad) {
            throw new Error(`Stock insuficiente. Solo hay ${producto.stockActual} unidades disponibles.`);
        }

        const precioUnitario = 100;
        const total = precioUnitario * cantidad;

        const pedido = await Pedido.create({
            nombreCliente,
            direccionCliente,
            productoId,
            cantidad,
            total,
            estado: 'pendiente',
            origen: 'publico'
        }, { transaction: t });

        await producto.decrement('stockActual', { by: cantidad, transaction: t });
        await t.commit();

        res.status(201).json({
            mensaje: 'Pedido recibido exitosamente.',
            pedido: {
                id: pedido.id,
                producto: producto.nombre,
                cantidad: pedido.cantidad,
                total: pedido.total,
                estado: pedido.estado
            }
        });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
});

// RUTAS PRIVADAS (a partir de aquí, se requiere token)

app.use(verificarToken);

// --- CRUD DE USUARIOS ---
app.get('/api/users', async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            where: { activo: true },
            attributes: ['id', 'nombre', 'email']
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar usuarios.' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { nombre, email } = req.body;
    if (req.usuario.id !== userId) {
        return res.status(403).json({ error: 'No puedes actualizar otro perfil.' });
    }
    try {
        const usuario = await Usuario.findByPk(userId);
        if (!usuario || !usuario.activo) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        usuario.nombre = nombre || usuario.nombre;
        usuario.email = email || usuario.email;
        await usuario.save();
        res.json({
            mensaje: 'Perfil actualizado.',
            usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar.' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (req.usuario.id !== userId) {
        return res.status(403).json({ error: 'No puedes eliminar otro usuario.' });
    }
    try {
        const usuario = await Usuario.findByPk(userId);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
        usuario.activo = false;
        await usuario.save();
        res.json({ mensaje: `Usuario ${userId} eliminado lógicamente.` });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar.' });
    }
});

// --- CRUD DE PRODUCTOS ---
app.get('/api/products', async (req, res) => {
    try {
        const productos = await Producto.findAll({ where: { activo: true } });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar productos.' });
    }
});

app.post('/api/products', async (req, res) => {
    const { sku, nombre, stock, categoria, ubicacion } = req.body;
    if (!sku || !nombre || stock === undefined) {
        return res.status(400).json({ error: 'SKU, nombre y stock son obligatorios.' });
    }
    try {
        const existe = await Producto.findOne({ where: { sku, activo: true } });
        if (existe) return res.status(409).json({ error: `Ya existe un producto con SKU ${sku}.` });
        const nuevo = await Producto.create({
            sku,
            nombre,
            stockActual: stock,
            stockMinimo: 0,
            categoria: categoria || 'General',
            ubicacion: ubicacion || 'Sin asignar'
        });
        res.status(201).json({ mensaje: 'Producto registrado.', producto: nuevo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar producto.' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { sku, nombre, stock, categoria, ubicacion } = req.body;
    try {
        const producto = await Producto.findByPk(id);
        if (!producto || !producto.activo) return res.status(404).json({ error: 'Producto no encontrado.' });
        if (sku && sku !== producto.sku) {
            const existe = await Producto.findOne({ where: { sku, activo: true } });
            if (existe) return res.status(409).json({ error: 'SKU duplicado.' });
        }
        producto.sku = sku || producto.sku;
        producto.nombre = nombre || producto.nombre;
        producto.stockActual = stock !== undefined ? stock : producto.stockActual;
        producto.categoria = categoria || producto.categoria;
        producto.ubicacion = ubicacion || producto.ubicacion;
        await producto.save();
        res.json({ mensaje: 'Producto actualizado.', producto });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar producto.' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const producto = await Producto.findByPk(id);
        if (!producto || !producto.activo) return res.status(404).json({ error: 'Producto no encontrado.' });
        producto.activo = false;
        await producto.save();
        res.json({ mensaje: `Producto ${id} eliminado lógicamente.`, producto });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto.' });
    }
});

// ENDPOINTS DE PEDIDOS 

// LISTAR TODOS LOS PEDIDOS
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            include: [
                { model: Producto, as: 'producto', attributes: ['id', 'nombre', 'sku'] },
                { model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['fechaPedido', 'DESC']]
        });
        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar pedidos.' });
    }
});

// CREAR PEDIDO INTERNO
app.post('/api/pedidos', async (req, res) => {
    const { productoId, cantidad } = req.body;
    if (!productoId || !cantidad) {
        return res.status(400).json({ error: 'productoId y cantidad son obligatorios.' });
    }
    const t = await sequelize.transaction();
    try {
        const producto = await Producto.findByPk(productoId, { transaction: t });
        if (!producto || !producto.activo) {
            throw new Error('Producto no encontrado.');
        }
        if (producto.stockActual < cantidad) {
            throw new Error('Stock insuficiente.');
        }
        const precioUnitario = 100;
        const total = precioUnitario * cantidad;
        const pedido = await Pedido.create({
            usuarioId: req.usuario.id,
            productoId,
            cantidad,
            total,
            estado: 'pendiente',
            origen: 'interno'
        }, { transaction: t });
        await producto.decrement('stockActual', { by: cantidad, transaction: t });
        await t.commit();
        res.status(201).json({ mensaje: 'Pedido creado.', pedido });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
});

// ACTUALIZAR ESTADO DE PEDIDO (NUEVO)
app.put('/api/pedidos/:id/estado', async (req, res) => {
    const pedidoId = parseInt(req.params.id, 10);
    const { estado } = req.body;

    // Validar que el estado sea uno de los permitidos
    const estadosValidos = ['pendiente', 'despachado', 'entregado', 'completado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido.' });
    }

    try {
        const pedido = await Pedido.findByPk(pedidoId);
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }

        // Actualizar estado
        pedido.estado = estado;
        await pedido.save();

        res.json({ mensaje: 'Estado del pedido actualizado.', pedido });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el estado del pedido.' });
    }
});

// MANEJO DE ERRORES

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

// SINCRONIZAR BD Y ENCENDER SERVIDOR

sequelize.sync()
    .then(() => {
        console.log(' Base de datos sincronizada.');
        app.listen(PORT, () => {
            console.log(` Servidor corriendo en http://localhost:${PORT}`);
            console.log(` JWT habilitado`);
            console.log(` Sequelize conectado a SQLite`);
            console.log(` Endpoints públicos: GET /api/products/publicos, POST /api/pedidos/publicos`);
        });
    })
    .catch(err => {
        console.error(' Error al sincronizar BD:', err);
    });