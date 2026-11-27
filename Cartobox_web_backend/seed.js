const { sequelize, Usuario, Producto } = require('./models');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        await sequelize.sync({ force: true });
        console.log(' Base de datos sincronizada.');

        const passwordHash = await bcrypt.hash('password123', 12);
        await Usuario.create({
            nombre: 'Angel Uriel',
            email: 'uriel@cartobox.mx',
            passwordHash
        });
        console.log(' Usuario insertado.');

        await Producto.bulkCreate([
            {
                sku: 'CB-403030-DC',
                nombre: 'Caja Corrugada Regular',
                stockActual: 45,
                stockMinimo: 50,
                categoria: 'Cartón Corrugado',
                ubicacion: 'Pasillo A-02'
            },
            {
                sku: 'EMB-BUR-100M',
                nombre: 'Rollo Poliburbuja',
                stockActual: 213,
                stockMinimo: 100,
                categoria: 'Material de Protección',
                ubicacion: 'Pasillo B-01'
            }
        ]);
        console.log(' Productos insertados.');

        console.log(' Seed completado exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error(' Error en seed:', error);
        process.exit(1);
    }
}

seed();




