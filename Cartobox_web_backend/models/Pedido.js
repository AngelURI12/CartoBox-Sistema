const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pedido = sequelize.define('Pedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'usuario_id'
    },
    nombreCliente: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'nombre_cliente'
    },
    direccionCliente: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'direccion_cliente'
    },
    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'producto_id'
    },
    cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    estado: {
        type: DataTypes.STRING,
        defaultValue: 'pendiente'
    },
    origen: {
        type: DataTypes.STRING,
        defaultValue: 'interno',
        allowNull: false
    },
    fechaPedido: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'fecha_pedido'
    }
}, {
    tableName: 'pedidos',
    timestamps: true
});

module.exports = Pedido;