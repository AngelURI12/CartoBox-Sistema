// config/database.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './cartobox.sqlite', // El archivo de la BD se creará en la raíz del backend
    logging: console.log // Muestra las consultas SQL en consola (útil para depurar)
});

module.exports = sequelize;

