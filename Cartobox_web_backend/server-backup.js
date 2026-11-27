require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cartobox-super-secret-key-2026-cambiar-en-produccion';
const JWT_EXPIRES_IN = '1h'; // Token de acceso expira en 1 hora

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================================
// BASE DE DATOS EN MEMORIA (Mock Data)
// ============================================================
// Nota: Las contraseñas ahora se almacenan hasheadas (bcrypt)
let usuarios = [
    { 
        id: 1, 
        nombre: 'Angel Uriel', 
        email: 'uriel@cartobox.mx', 
        passwordHash: bcrypt.hashSync('password123', 12), // Contraseña de ejemplo: "password123"
        activo: true 
    }
];

let productos = [
    { id: 1, sku: 'CB-403030-DC', nombre: 'Caja Corrugada Regular', stock: 45, categoria: 'Cartón Corrugado', ubicacion: 'Pasillo A-02', activo: true },
    { id: 2, sku: 'EMB-BUR-100M', nombre: 'Rollo Poliburbuja', stock: 213, categoria: 'Material de Protección', ubicacion: 'Pasillo B-01', activo: true }
];

let nextUserId = 2;
let nextProductId = 3;

// ============================================================
// MIDDLEWARE DE VERIFICACIÓN DE TOKEN (JWT)
// ============================================================
/**
 * Este middleware intercepta las peticiones a rutas protegidas.
 * Extrae el token del header "Authorization: Bearer <token>",
 * lo verifica criptográficamente y, si es válido, adjunta el usuario
 * decodificado al objeto `req` para que los controladores lo usen.
 */
const verificarToken = (req, res, next) => {
    //  Obtener el header de autorización
    const authHeader = req.headers['authorization'];
    
    //  Verificar que exista y tenga el formato "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Acceso denegado. Token no proporcionado o formato inválido.' 
        });
    }

    // Extraer el token (quitando "Bearer ")
    const token = authHeader.split(' ')[1];

    try {
        //  Verificar el token con el secreto y el algoritmo fijo (HS256)
    
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

        //  Adjuntar el payload decodificado al request
        req.usuario = decoded;

        // Continuar al controlador
        next();
    } catch (error) {
        // Token inválido, expirado o con firma incorrecta
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado. Inicia sesión nuevamente.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido o firma incorrecta.' });
        }
        return res.status(401).json({ error: 'Error de autenticación.' });
    }
};


// RUTAS PÚBLICAS (No requieren token)


// Ruta de bienvenida (pública)
app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Bienvenido al Backend de CartoBox Mexico!',
        version: '2.0.0 - Con JWT',
        autenticacion: 'Usa POST /api/auth/login para obtener un token',
        rutas_publicas: ['POST /api/auth/login', 'POST /api/register'],
        rutas_privadas: ['GET /api/products', 'POST /api/products', 'PUT /api/products/:id', 'DELETE /api/products/:id', 'GET /api/users', 'PUT /api/users/:id']
    });
});

//LOGIN: Autentica un usuario y devuelve un JWT.

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    }

    // Buscar usuario activo por email
    const usuario = usuarios.find(u => u.email === email && u.activo);
    if (!usuario) {
        // Mensaje genérico para no revelar si el email existe o no (previene enumeración de usuarios)
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Comparar contraseña con el hash almacenado (bcrypt)
    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar JWT 
    const payload = {
        id: usuario.id,
        email: usuario.email
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256'
    });

    res.status(200).json({
        mensaje: 'Autenticación exitosa.',
        token: token,
        tipo: 'Bearer',
        expiraEn: JWT_EXPIRES_IN
    });
});

/**
 * REGISTRO: Crea un nuevo usuario con contraseña hasheada.
 */
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    // Validaciones
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'email y contraseña son obligatorios.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const existe = usuarios.find(u => u.email === email && u.activo);
    if (existe) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico.' });
    }

    // Hashear la contraseña antes de almacenarla 
    const passwordHash = await bcrypt.hash(password, 12);

    const nuevoUsuario = {
        id: nextUserId++,
        nombre,
        email,
        passwordHash,
        activo: true
    };

    usuarios.push(nuevoUsuario);
    res.status(201).json({
        mensaje: 'Usuario registrado exitosamente. Ahora puedes iniciar sesión.',
        usuario: { id: nuevoUsuario.id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email }
    });
});

// RUTAS PRIVADAS (Requieren token JWT válido)

app.use(verificarToken);

// --- CRUD DE USUARIOS (protegido) ---

app.get('/api/users', (req, res) => {
    const usuariosActivos = usuarios.filter(u => u.activo).map(u => ({
        id: u.id, nombre: u.nombre, email: u.email
    }));
    res.status(200).json(usuariosActivos);
});

app.get('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const usuario = usuarios.find(u => u.id === userId && u.activo);

    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.status(200).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email });
});

app.put('/api/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { nombre, email, password } = req.body;
    const usuario = usuarios.find(u => u.id === userId && u.activo);

    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Solo el propio usuario puede actualizar su perfil (autorización básica)
    if (req.usuario.id !== userId) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar este perfil.' });
    }

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido.' });
        }
        const existe = usuarios.find(u => u.email === email && u.id !== userId && u.activo);
        if (existe) {
            return res.status(409).json({ error: 'Email ya en uso.' });
        }
    }

    usuario.nombre = nombre || usuario.nombre;
    usuario.email = email || usuario.email;
    if (password && password.length >= 8) {
        usuario.passwordHash = await bcrypt.hash(password, 12);
    }

    res.status(200).json({
        mensaje: 'Perfil actualizado correctamente.',
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
    });
});

app.delete('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const usuario = usuarios.find(u => u.id === userId && u.activo);

    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (req.usuario.id !== userId) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este usuario.' });
    }

    usuario.activo = false;
    res.status(200).json({ mensaje: `Usuario ${userId} eliminado lógicamente.` });
});

// --- CRUD DE PRODUCTOS (protegido) ---

app.get('/api/products', (req, res) => {
    const productosActivos = productos.filter(p => p.activo);
    res.status(200).json(productosActivos);
});

app.get('/api/products/:id', (req, res) => {
    const productoId = parseInt(req.params.id, 10);
    const producto = productos.find(p => p.id === productoId && p.activo);

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    res.status(200).json(producto);
});

app.post('/api/products', (req, res) => {
    const { sku, nombre, stock, categoria, ubicacion } = req.body;

    if (!sku || !nombre || stock === undefined) {
        return res.status(400).json({ error: 'SKU, nombre y stock son obligatorios.' });
    }

    if (typeof stock !== 'number' || stock < 0) {
        return res.status(400).json({ error: 'El stock debe ser un número >= 0.' });
    }

    const existe = productos.find(p => p.sku === sku && p.activo);
    if (existe) {
        return res.status(409).json({ error: `Ya existe un producto con el SKU ${sku}.` });
    }

    const nuevoProducto = {
        id: nextProductId++,
        sku, nombre, stock,
        categoria: categoria || 'General',
        ubicacion: ubicacion || 'Sin asignar',
        activo: true
    };

    productos.push(nuevoProducto);
    res.status(201).json({ mensaje: 'Producto registrado.', producto: nuevoProducto });
});

app.put('/api/products/:id', (req, res) => {
    const productoId = parseInt(req.params.id, 10);
    const { sku, nombre, stock, categoria, ubicacion } = req.body;
    const producto = productos.find(p => p.id === productoId && p.activo);

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    if (sku && sku !== producto.sku) {
        const existe = productos.find(p => p.sku === sku && p.id !== productoId && p.activo);
        if (existe) return res.status(409).json({ error: 'SKU duplicado.' });
    }

    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
        return res.status(400).json({ error: 'Stock inválido.' });
    }

    producto.sku = sku || producto.sku;
    producto.nombre = nombre || producto.nombre;
    producto.stock = stock !== undefined ? stock : producto.stock;
    producto.categoria = categoria || producto.categoria;
    producto.ubicacion = ubicacion || producto.ubicacion;

    res.status(200).json({ mensaje: 'Producto actualizado.', producto });
});

app.delete('/api/products/:id', (req, res) => {
    const productoId = parseInt(req.params.id, 10);
    const producto = productos.find(p => p.id === productoId && p.activo);

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    producto.activo = false;
    res.status(200).json({ mensaje: `Producto ${productoId} eliminado lógicamente.`, producto });
});

// ============================================================
// MANEJO DE RUTAS NO ENCONTRADAS Y ERRORES
// ============================================================
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.', ruta: req.url, metodo: req.method });
});

app.use((err, req, res, next) => {
    console.error('Error interno:', err);
    // No exponer detalles del error en producción (OWASP: Security Misconfiguration)
    res.status(500).json({ error: 'Error interno del servidor.' });
});

// ============================================================
// ENCENDER EL SERVIDOR
// ============================================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(` Autenticación JWT habilitada`);
    console.log(` Endpoints públicos: POST /api/auth/login, POST /api/register`);
    console.log(` Endpoints privados: /api/products/*, /api/users/* (requieren Bearer Token)`);
});