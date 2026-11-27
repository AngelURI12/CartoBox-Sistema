const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Producto = sequelize.define('Producto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sku: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    stockActual: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    stockMinimo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    categoria: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ubicacion: {
        type: DataTypes.STRING,
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'productos',
    timestamps: true
});

module.exports = Producto;
