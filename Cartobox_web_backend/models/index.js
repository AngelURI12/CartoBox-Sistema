const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Producto = require('./Producto');
const Pedido = require('./Pedido');

Usuario.hasMany(Pedido, { foreignKey: 'usuarioId', as: 'pedidos' });
Pedido.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

Producto.hasMany(Pedido, { foreignKey: 'productoId', as: 'pedidos' });
Pedido.belongsTo(Producto, { foreignKey: 'productoId', as: 'producto' });

module.exports = { sequelize, Usuario, Producto, Pedido };